#!/usr/bin/env python3
"""TUI controller for the Even Realities Car Nav dev environment.

Manages two processes side-by-side:
  - `npm run simulate` (Even Hub simulator)
  - `npm run dev`      (Vite dev server on :5173)

Logs are written to ./logs/sim.log and ./logs/server.log so the TUI stays clean.

Why Windows process kill is hard here: the simulator is Electron-based and spawns
helper processes that get reparented out of taskkill /T's reach. The fix is to
put each `npm` invocation in its own Win32 Job Object — Job Objects propagate
to descendants, and TerminateJobObject is atomic across the whole job, so no
helper escapes.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOGS = ROOT / "logs"
LOGS.mkdir(exist_ok=True)

IS_WIN = os.name == "nt"

# Enable ANSI / VT escape sequences in legacy Windows consoles.
if IS_WIN:
    os.system("")
    import msvcrt  # type: ignore
    import ctypes
    import ctypes.wintypes as wintypes

DEBUG = os.environ.get("RUN_PY_DEBUG") == "1"
DEBUG_LOG = LOGS / "run.py.debug.log"


def dbg(msg: str) -> None:
    if not DEBUG:
        return
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    except Exception:
        pass


# ─── Win32 Job Object helpers ─────────────────────────────────────────────────
# Job Objects are the Windows-correct way to kill an entire process tree.
# A process inside a job — and every descendant it spawns — gets terminated
# atomically when the job is terminated, regardless of reparenting.

if IS_WIN:
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
    PROCESS_ALL_ACCESS = 0x001F0FFF
    JobObjectExtendedLimitInformation = 9

    class _IO_COUNTERS(ctypes.Structure):
        _fields_ = [
            ("ReadOperationCount", ctypes.c_uint64),
            ("WriteOperationCount", ctypes.c_uint64),
            ("OtherOperationCount", ctypes.c_uint64),
            ("ReadTransferCount", ctypes.c_uint64),
            ("WriteTransferCount", ctypes.c_uint64),
            ("OtherTransferCount", ctypes.c_uint64),
        ]

    class _JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64),
            ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", ctypes.c_uint32),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", ctypes.c_uint32),
            ("Affinity", ctypes.c_void_p),
            ("PriorityClass", ctypes.c_uint32),
            ("SchedulingClass", ctypes.c_uint32),
        ]

    class _JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", _JOBOBJECT_BASIC_LIMIT_INFORMATION),
            ("IoInfo", _IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    _kernel32 = ctypes.windll.kernel32
    _kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    _kernel32.OpenProcess.restype = wintypes.HANDLE
    _kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]


def _create_kill_job() -> int | None:
    if not IS_WIN:
        return None
    try:
        job = _kernel32.CreateJobObjectW(None, None)
        if not job:
            dbg(f"CreateJobObjectW failed: {ctypes.get_last_error()}")
            return None
        info = _JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        ok = _kernel32.SetInformationJobObject(
            job, JobObjectExtendedLimitInformation,
            ctypes.byref(info), ctypes.sizeof(info),
        )
        if not ok:
            dbg(f"SetInformationJobObject failed: {ctypes.get_last_error()}")
            _kernel32.CloseHandle(job)
            return None
        return int(job)
    except Exception as e:
        dbg(f"_create_kill_job exception: {e}")
        return None


def _assign_pid_to_job(job: int | None, pid: int) -> bool:
    if job is None or not IS_WIN:
        return False
    try:
        h = _kernel32.OpenProcess(PROCESS_ALL_ACCESS, False, pid)
        if not h:
            dbg(f"OpenProcess({pid}) failed: {ctypes.get_last_error()}")
            return False
        try:
            ok = bool(_kernel32.AssignProcessToJobObject(job, h))
            if not ok:
                dbg(f"AssignProcessToJobObject({pid}) failed: {ctypes.get_last_error()}")
            else:
                dbg(f"Assigned pid {pid} to job 0x{job:x}")
            return ok
        finally:
            _kernel32.CloseHandle(h)
    except Exception as e:
        dbg(f"_assign_pid_to_job exception: {e}")
        return False


def _terminate_job(job: int | None) -> None:
    if job is None or not IS_WIN:
        return
    try:
        _kernel32.TerminateJobObject(job, 1)
        _kernel32.CloseHandle(job)
        dbg(f"Terminated + closed job 0x{job:x}")
    except Exception as e:
        dbg(f"_terminate_job exception: {e}")


# ─── ANSI palette ─────────────────────────────────────────────────────────────

class C:
    reset = "\033[0m"
    bold = "\033[1m"
    dim = "\033[2m"
    cyan = "\033[36m"
    green = "\033[32m"
    yellow = "\033[33m"
    grey = "\033[90m"
    red = "\033[31m"
    white = "\033[97m"


# ─── Process wrapper ──────────────────────────────────────────────────────────

class Proc:
    def __init__(self, label: str, args: list[str], log: Path) -> None:
        self.label = label
        self.args = args
        self.log = log
        self.proc: subprocess.Popen | None = None
        self._log_fh = None
        self._job: int | None = None

    def running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def start(self) -> None:
        if self.running():
            return
        self._log_fh = open(self.log, "ab")
        if IS_WIN:
            cmd = ["npm.cmd", *self.args[1:]]
        else:
            cmd = self.args
        # Create the Job Object BEFORE Popen so we can assign immediately. Any
        # descendant the process spawns after assignment is auto-included.
        self._job = _create_kill_job()
        self.proc = subprocess.Popen(
            cmd, cwd=ROOT,
            stdout=self._log_fh, stderr=subprocess.STDOUT,
        )
        if IS_WIN:
            assigned = _assign_pid_to_job(self._job, self.proc.pid)
            if not assigned:
                # Job assignment failed — fall back to taskkill at stop time.
                if self._job is not None:
                    try:
                        _kernel32.CloseHandle(self._job)
                    except Exception:
                        pass
                    self._job = None
        dbg(f"{self.label} started: pid={self.proc.pid} job={'yes' if self._job else 'no'}")

    def stop(self) -> None:
        if self.proc is None and self._job is None:
            return
        pid = self.proc.pid if self.proc is not None else None
        try:
            if IS_WIN:
                if self._job is not None:
                    _terminate_job(self._job)
                else:
                    # No job — fall back to PS tree-walk + taskkill.
                    if pid is not None:
                        _kill_tree_windows(pid)
            else:
                if self.proc is not None:
                    self.proc.terminate()
                    try:
                        self.proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.proc.kill()
        except Exception as e:
            dbg(f"{self.label}.stop exception: {e}")
        finally:
            self.proc = None
            self._job = None
            if self._log_fh is not None:
                try:
                    self._log_fh.close()
                except Exception:
                    pass
                self._log_fh = None


def _kill_tree_windows(pid: int) -> None:
    """Fallback kill path used only when Job Object assignment failed."""
    ps = (
        "$ErrorActionPreference='SilentlyContinue';"
        "function K($p){"
        " Get-CimInstance Win32_Process -Filter \"ParentProcessId=$p\" |"
        " ForEach-Object { K $_.ProcessId };"
        " Stop-Process -Id $p -Force"
        f"}}; K {pid}"
    )
    try:
        subprocess.run(
            ["powershell", "-NonInteractive", "-NoProfile", "-Command", ps],
            check=False, capture_output=True, timeout=10,
        )
    except Exception:
        pass
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            check=False, capture_output=True, timeout=5,
        )
    except Exception:
        pass


sim = Proc("sim", ["npm", "run", "simulate"], LOGS / "sim.log")
server = Proc("server", ["npm", "run", "dev"], LOGS / "server.log")

ANIM_FRAMES = ["running.  ", "running.. ", "running..."]

# ─── Transient banner ─────────────────────────────────────────────────────────

_msg: str = ""
_msg_color: str = ""
_msg_until: float = 0.0


def set_msg(text: str, duration: float = 2.5, color: str = "") -> None:
    global _msg, _msg_color, _msg_until
    _msg = text
    _msg_color = color or C.cyan
    _msg_until = time.monotonic() + duration


def current_msg() -> str:
    if _msg and time.monotonic() < _msg_until:
        return f"  {C.bold}{_msg_color}{_msg}{C.reset}"
    return ""


# ─── Render ───────────────────────────────────────────────────────────────────

BUTTON_COLOR = {
    "start sim":    C.green,
    "start server": C.green,
    "start all":    C.green,
    "stop all":     C.red,
    "restart":      C.yellow,
    "quit":         C.grey,
}


def button(label: str, pad_to: int = 14) -> str:
    color = BUTTON_COLOR.get(label, C.white)
    inner = f"[{label}]"
    pad = max(0, pad_to - len(inner))
    return f"{color}{inner}{C.reset}{' ' * pad}"


def status(p: Proc, frame: int) -> str:
    if p.running():
        return f"{C.green}{ANIM_FRAMES[frame]}{C.reset}"
    return f"{C.grey}stopped   {C.reset}"


def render(frame: int) -> None:
    sys.stdout.write("\033[H\033[J")
    out = []
    out.append(f"{C.bold}{C.cyan}Even Realities Car Nav · dev runner{C.reset}\n")
    out.append(f"{C.dim}{'─' * 44}{C.reset}\n")
    out.append(f"  {C.bold}{C.yellow}1.{C.reset} {button('start sim')} {C.dim}│{C.reset}  {status(sim, frame)}\n")
    out.append(f"  {C.bold}{C.yellow}2.{C.reset} {button('start server')} {C.dim}│{C.reset}  {status(server, frame)}\n")
    out.append(f"  {C.bold}{C.yellow}3.{C.reset} {button('start all')} {C.dim}│{C.reset}\n")
    out.append(f"  {C.bold}{C.yellow}4.{C.reset} {button('stop all')} {C.dim}│{C.reset}\n")
    out.append(f"  {C.bold}{C.yellow}5.{C.reset} {button('restart')} {C.dim}│{C.reset}\n")
    out.append(f"  {C.bold}{C.yellow}q.{C.reset} {button('quit')} {C.dim}│{C.reset}\n")
    out.append("\n")
    msg = current_msg()
    if msg:
        out.append(f"{msg}\n\n")
    else:
        out.append("\n")
    out.append(f"  {C.dim}logs: {LOGS}{C.reset}\n")
    out.append("\n")
    out.append(f"{C.cyan}> {C.reset}")
    sys.stdout.write("".join(out))
    sys.stdout.flush()


# ─── Input ────────────────────────────────────────────────────────────────────

def read_key() -> str | None:
    if IS_WIN:
        if msvcrt.kbhit():
            ch = msvcrt.getch()
            try:
                return ch.decode("utf-8", errors="ignore").lower()
            except Exception:
                return None
        return None
    import select
    if select.select([sys.stdin], [], [], 0.05)[0]:
        s = sys.stdin.readline().strip().lower()
        return s[:1] if s else None
    return None


# ─── Actions ──────────────────────────────────────────────────────────────────

def stop_all() -> None:
    sim.stop()
    server.stop()


Action = str  # "continue" | "restart" | "exit"


def handle(key: str) -> Action:
    if key == "1":
        sim.start()
    elif key == "2":
        server.start()
    elif key == "3":
        sim.start()
        server.start()
    elif key == "4":
        set_msg("stopping all...", duration=1.8, color=C.red)
        stop_all()
    elif key == "5":
        set_msg("restarting...", duration=2.5, color=C.yellow)
        return "restart"
    elif key in ("q", "\x1b", "\x03"):
        set_msg("shutting down...", duration=5.0, color=C.red)
        stop_all()
        return "exit"
    return "continue"


# ─── Main loop ────────────────────────────────────────────────────────────────

def main() -> int:
    frame = 0
    last_anim = 0.0
    pending_restart_at: float | None = None
    try:
        render(frame)
        while True:
            now = time.monotonic()

            if pending_restart_at is not None and now >= pending_restart_at:
                sim.start()
                server.start()
                pending_restart_at = None
                render(frame)

            if now - last_anim >= 0.4:
                frame = (frame + 1) % len(ANIM_FRAMES)
                last_anim = now
                render(frame)

            key = read_key()
            if key:
                result = handle(key)
                render(frame)
                if result == "exit":
                    break
                if result == "restart":
                    stop_all()
                    render(frame)
                    pending_restart_at = time.monotonic() + 0.6

            time.sleep(0.04)
    except KeyboardInterrupt:
        pass
    finally:
        stop_all()
        sys.stdout.write("\033[H\033[J")
        sys.stdout.write(f"{C.dim}Shut down. Bye.{C.reset}\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())

import subprocess, pathlib
root = pathlib.Path("C:/Users/dhanu/Desktop/git-projects/new-ideas")
subprocess.run(["git","add","."], cwd=root, shell=True)
msg = "fix: snapshot quality — hiddenCount checkVisibility, input redaction ALL, CSS.escape try, quality gate\n\n- hiddenCount now uses checkVisibility || getClientRects (fixes fixed/svg/opacity bug)\n- htmlSnippet redacts ALL inputs to [REDACTED] (was password-only)\n- inventory CSS.escape wrapped try/catch (weird ids)\n- fixtures sanitized + redacted, quality.py single-file gate <2s\n- CI now runs scripts/quality.py + build verify"
r = subprocess.run(["git","commit","-m",msg], cwd=root, capture_output=True, text=True, shell=True)
print(r.stdout)
print(r.stderr)
print(r.returncode)
r2 = subprocess.run(["git","push"], cwd=root, capture_output=True, text=True, shell=True)
print("push stdout", r2.stdout[:2000])
print("push stderr", r2.stderr[:2000])
print("push rc", r2.returncode)

import subprocess, pathlib
root = pathlib.Path("C:/Users/dhanu/Desktop/git-projects/new-ideas")
subprocess.run(["git","add","."], cwd=root, shell=True)
msg = "fix: pretty JSON for snapshots — valid, human-readable, Allure-friendly\n\n- GsonBuilder().setPrettyPrinting() instead of compact\n- fixtures rewritten indent=2 and re-validated\n- quality gate still <1M, mvn verify rc 0"
r = subprocess.run(["git","commit","-m",msg], cwd=root, capture_output=True, text=True, shell=True)
print(r.stdout)
print(r.stderr)
r2 = subprocess.run(["git","push"], cwd=root, capture_output=True, text=True, shell=True)
print(r2.stdout[:1000])
print(r2.stderr[:2000])
print("push rc", r2.returncode)

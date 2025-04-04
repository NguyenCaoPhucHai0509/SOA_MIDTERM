# Run
1. Go to this repository directory.
2. Open 4 tabs, 3 of them for services, you should turn on virtual environment.
3. Each of them you must run 3 batch files respectively
For example:
    - In first tab (you can title it like `title Gateway` for easily controling) type: `run_gateway`
    - Then the gateway is running in port 8000. You could check this batch file by this command `notepad run_gateway.bat`
About Frontend - UI, it's not necessary to turn virtual environment.

This is example batch script for automatic open 4 tabs as I've said above:
```
@echo off

wt ^
	new-tab cmd /k "title Gateway && cd \"%USERPROFILE%\Desktop\SOA\midterm\" && code . && workon env1" ; ^
    	new-tab cmd /k "title Menu && cd \"%USERPROFILE%\Desktop\SOA\midterm\" && workon env1" ; ^
    	new-tab cmd /k "title Staff && cd \"%USERPROFILE%\Desktop\SOA\midterm\" && workon env1"; ^
	new-tab cmd /k "title Frontend && cd \"%USERPROFILE%\Desktop\SOA\midterm\frontend""
```

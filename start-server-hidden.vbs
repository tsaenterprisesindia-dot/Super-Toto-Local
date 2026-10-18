' Launches the Super Toto Local always-on server with no visible window.
' Used by the Startup-folder shortcut so the app is up whenever you log in.
Dim base
base = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """ & base & "\start-server.bat""", 0, False

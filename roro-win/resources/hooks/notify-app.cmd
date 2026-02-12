@echo off
REM Hook script that transforms Claude Code events and sends them to the Electron app server
REM Receives hook data via stdin, normalizes event types, and POSTs to the app's hook endpoint
REM
REM Improvements over the bash version:
REM   - Uses Node.js http module instead of curl (always available with Claude Code)
REM   - Reads stdin via Node.js directly (avoids cmd.exe stdin piping issues)
REM   - Robust temp file handling with unique naming
REM   - Graceful error handling (exit 0 always to not block Claude Code)

setlocal enabledelayedexpansion

REM Generate a unique temp file path
set "TEMPFILE=%TEMP%\evero_hook_%RANDOM%%RANDOM%.json"

REM Read all stdin into the temp file using findstr (handles binary/special chars better than more)
findstr "^" > "%TEMPFILE%" 2>nul

REM If the temp file is empty or doesn't exist, exit silently
if not exist "%TEMPFILE%" exit /b 0
for %%A in ("%TEMPFILE%") do if %%~zA==0 (del "%TEMPFILE%" 2>nul & exit /b 0)

REM Process the hook data and POST it to the app server using Node.js
node -e "try{const fs=require('fs'),http=require('http');const raw=fs.readFileSync(process.argv[1],'utf-8').trim();if(!raw){process.exit(0)}const hookData=JSON.parse(raw);const hookEvent=hookData.hook_event_name||'unknown';let eventType='message';const eventMap={'PreToolUse':'tool_use','PostToolUse':'tool_result','PostToolUseFailure':'tool_failure','UserPromptSubmit':'thinking_start','Stop':'thinking_end','PermissionRequest':'permission_request','Notification':'notification','SessionStart':'session_start','SessionEnd':'session_end','SubagentStop':'subagent_complete','PreCompact':'compact_start'};eventType=eventMap[hookEvent]||eventType;const payload=JSON.stringify({agentId:process.env.CLAUDE_AGENT_ID||'unknown',eventType:eventType,timestamp:Date.now(),data:hookData});const req=http.request({hostname:'localhost',port:3067,path:'/hooks/agent-event',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},()=>{});req.on('error',()=>{});req.write(payload);req.end();setTimeout(()=>process.exit(0),500)}catch(e){process.exit(0)}" "%TEMPFILE%" 2>nul

REM Clean up temp file
del "%TEMPFILE%" 2>nul
exit /b 0

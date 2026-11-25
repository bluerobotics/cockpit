; Lets Cockpit through Windows Firewall at install time, so that Windows does not ask the user about it on first
; run. Both commands need the elevation that only an install for all users has; on an install for the current
; user they fail without consequence and Windows asks, as it did before. Each result is popped unread for that reason.
!define VIDEO_SERVICE "$INSTDIR\resources\go2rtc\go2rtc.exe"

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Cockpit" program="$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall add rule name="Cockpit" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=any'
  Pop $0
  ; The video service only serves Cockpit, inside this computer. Windows asks about it all the same, for the
  ; sockets it opens to look names up, unless a rule already answers. Blocking is the answer that fits.
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Cockpit video service" program="${VIDEO_SERVICE}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall add rule name="Cockpit video service" dir=in action=block program="${VIDEO_SERVICE}" enable=yes profile=any'
  Pop $0
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Cockpit" program="$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Cockpit video service" program="${VIDEO_SERVICE}"'
  Pop $0
!macroend

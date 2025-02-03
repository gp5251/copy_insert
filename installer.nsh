!macro customInstall
  ; 添加右键菜单
  WriteRegStr HKCR "*\shell\CopyInsert" "" "使用CopyInsert处理"
  WriteRegStr HKCR "*\shell\CopyInsert\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; 删除右键菜单
  DeleteRegKey HKCR "*\shell\CopyInsert"
!macroend 
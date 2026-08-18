param(
  [string]$Api = "http://127.0.0.1:3080/statuslight/api",
  [string]$Config = ""
)
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
$ErrorActionPreference = "SilentlyContinue"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SLWin {
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$root = $Api
$idx = $Api.IndexOf("/statuslight/api")
if ($idx -ge 0) { $root = $Api.Substring(0, $idx) }
$mainUrl = $root
$wc = New-Object System.Net.WebClient
function Find-GuiWindow {
  $cands = New-Object System.Collections.ArrayList
  foreach ($name in @("chrome", "msedge", "firefox", "brave", "opera", "360chrome", "qqbrowser", "seamonkey")) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      if ($p.MainWindowHandle -ne 0) {
        if ($p.MainWindowTitle -like "*DeepSeek Harness*") { return $p.MainWindowHandle }
        [void]$cands.Add($p.MainWindowHandle)
      }
    }
  }
  if ($cands.Count -gt 0) { return [int]$cands[0] }
  return 0
}
function Open-Gui {
  $hwnd = Find-GuiWindow
  if ($hwnd -ne 0) {
    try {
      if ([SLWin]::IsIconic($hwnd)) { [void][SLWin]::ShowWindow($hwnd, 9) }
      [void][SLWin]::SetForegroundWindow($hwnd)
      return
    } catch {}
  }
  try { Start-Process $mainUrl } catch {}
}
$window = New-Object System.Windows.Window
$window.Title = "StatusLight"
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.AllowsTransparency = $true
$window.Background = [System.Windows.Media.Brushes]::Transparent
$window.Topmost = $true
$window.ShowInTaskbar = $false
$window.Width = 190
$window.Height = 236
$window.Left = [System.Windows.SystemParameters]::PrimaryScreenWidth - 210
$window.Top = 20
if ($Config -ne "" -and (Test-Path $Config)) {
  try {
    $cfg = Get-Content -Raw -Encoding UTF8 -Path $Config | ConvertFrom-Json
    if ($cfg.windowPos -and $null -ne $cfg.windowPos.x -and $null -ne $cfg.windowPos.y) {
      $window.Left = [double]$cfg.windowPos.x
      $window.Top = [double]$cfg.windowPos.y
    }
  } catch {}
}
$script:baseTop = [double]$window.Top
$grid = New-Object System.Windows.Controls.Grid
$grid.Width = 190
$grid.Height = 236
$chatImg = New-Object System.Windows.Controls.Image
$chatImg.Width = 190
$chatImg.Height = 90
$chatImg.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Left
$chatImg.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
$chatImg.Margin = New-Object System.Windows.Thickness(0, 4, 0, 0)
$chatImg.Stretch = [System.Windows.Media.Stretch]::Uniform
$chatImg.Visibility = [System.Windows.Visibility]::Collapsed
[void]$grid.Children.Add($chatImg)
$chatText = New-Object System.Windows.Controls.TextBlock
$chatText.Margin = New-Object System.Windows.Thickness(0, 19, 0, 0)
$chatText.Width = 100
$chatText.Height = 34
$chatText.ClipToBounds = $true
$chatText.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center
$chatText.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
$chatText.TextWrapping = [System.Windows.TextWrapping]::Wrap
$chatText.TextTrimming = [System.Windows.TextTrimming]::CharacterEllipsis
$chatText.TextAlignment = [System.Windows.TextAlignment]::Center
$chatText.FontFamily = New-Object System.Windows.Media.FontFamily("Microsoft YaHei")
$chatText.FontSize = 13
$chatText.FontWeight = [System.Windows.FontWeights]::Bold
$chatText.Foreground = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(43, 43, 58))
$chatText.Visibility = [System.Windows.Visibility]::Collapsed
[void]$grid.Children.Add($chatText)
$viewLink = New-Object System.Windows.Controls.TextBlock
$viewLink.Margin = New-Object System.Windows.Thickness(0, 64, 0, 0)
$viewLink.Width = 100
$viewLink.Height = 18
$viewLink.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center
$viewLink.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
$viewLink.Text = "查看详细"
$viewLink.TextAlignment = [System.Windows.TextAlignment]::Center
$viewLink.FontFamily = New-Object System.Windows.Media.FontFamily("Microsoft YaHei")
$viewLink.FontSize = 11
$viewLink.FontWeight = [System.Windows.FontWeights]::Bold
$viewLink.Foreground = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(43, 95, 217))
$viewLink.TextDecorations = [System.Windows.TextDecorations]::Underline
$viewLink.Cursor = [System.Windows.Input.Cursors]::Hand
$viewLink.Visibility = [System.Windows.Visibility]::Collapsed
$viewLink.Add_MouseLeftButtonDown({ param($s, $e) $e.Handled = $true })
$viewLink.Add_MouseLeftButtonUp({
  param($s, $e)
  $e.Handled = $true
  if ($script:lastNotif -ne $null) {
    $q = "/jump?agent=" + [uri]::EscapeDataString([string]$script:lastNotif.agentId)
    if ($script:lastNotif.parentId) { $q += "&parent=" + [uri]::EscapeDataString([string]$script:lastNotif.parentId) }
    if ($script:lastNotif.mode) { $q += "&mode=" + [uri]::EscapeDataString([string]$script:lastNotif.mode) }
    try { Invoke-RestMethod -Uri ($Api + $q) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
    try { Invoke-RestMethod -Uri ($Api + "/dismiss?seq=" + [int]$script:lastNotif.seq) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
  }
  Open-Gui
  Hide-Chat
})
[void]$grid.Children.Add($viewLink)
$closeBtn = New-Object System.Windows.Controls.Border
$closeBtn.Width = 20
$closeBtn.Height = 20
$closeBtn.CornerRadius = New-Object System.Windows.CornerRadius(10)
$closeBtn.Background = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(220, 60, 60))
$closeBtn.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
$closeBtn.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
$closeBtn.Margin = New-Object System.Windows.Thickness(0, 6, 6, 0)
$closeBtn.Cursor = [System.Windows.Input.Cursors]::Hand
$closeBtn.Visibility = [System.Windows.Visibility]::Collapsed
$closeInner = New-Object System.Windows.Controls.TextBlock
$closeInner.Text = "×"
$closeInner.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center
$closeInner.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
$closeInner.Foreground = [System.Windows.Media.Brushes]::White
$closeInner.FontSize = 13
$closeInner.FontWeight = [System.Windows.FontWeights]::Bold
$closeBtn.Child = $closeInner
$closeBtn.Add_MouseLeftButtonDown({ param($s, $e) $e.Handled = $true })
$closeBtn.Add_MouseLeftButtonUp({
  param($s, $e)
  $e.Handled = $true
  if ($script:lastNotif -ne $null) {
    try { Invoke-RestMethod -Uri ($Api + "/dismiss?seq=" + [int]$script:lastNotif.seq) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
  }
  Hide-Chat
})
[void]$grid.Children.Add($closeBtn)
$charImg = New-Object System.Windows.Controls.Image
$charImg.Width = 130
$charImg.Height = 130
$charImg.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center
$charImg.VerticalAlignment = [System.Windows.VerticalAlignment]::Bottom
$charImg.Stretch = [System.Windows.Media.Stretch]::Uniform
[void]$grid.Children.Add($charImg)
$window.Content = $grid
$script:state = $null
$script:lastImg = ""
$script:lastChat = ""
$script:lastSeq = 0
$script:tick = 0
$script:drag = $null
$script:lastNotif = $null
$script:chatUntil = 0
$script:curOffset = 0
function Hide-Chat {
  $script:chatUntil = 0
  $chatImg.Visibility = [System.Windows.Visibility]::Collapsed
  $chatText.Visibility = [System.Windows.Visibility]::Collapsed
  $viewLink.Visibility = [System.Windows.Visibility]::Collapsed
  $closeBtn.Visibility = [System.Windows.Visibility]::Collapsed
}
function Apply-Offset([int]$offset) {
  if ($offset -eq $script:curOffset) { return }
  $script:curOffset = $offset
  $grow = [Math]::Max(0, $offset)
  $down = [Math]::Max(0, -$offset)
  $window.Height = 236 + $grow
  $window.Top = $script:baseTop - $grow
  $chatImg.Margin = New-Object System.Windows.Thickness(0, (4 + $down), 0, 0)
  $chatText.Margin = New-Object System.Windows.Thickness(0, (19 + $grow), 0, 0)
  $viewLink.Margin = New-Object System.Windows.Thickness(0, (64 + $grow), 0, 0)
  $closeBtn.Margin = New-Object System.Windows.Thickness(0, (6 + $down), 6, 0)
}
function Read-Json {
  try { return Invoke-RestMethod -Uri $Api -TimeoutSec 3 -UseBasicParsing } catch { return $null }
}
function New-Bitmap([byte[]]$bytes) {
  $ms = New-Object System.IO.MemoryStream(,$bytes)
  $bi = New-Object System.Windows.Media.Imaging.BitmapImage
  $bi.BeginInit()
  $bi.StreamSource = $ms
  $bi.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bi.EndInit()
  $bi.Freeze()
  return $bi
}
function Set-CharImage([string]$url) {
  if ($url -eq "" -or $url -eq $script:lastImg) { return }
  $script:lastImg = $url
  try {
    $bytes = $wc.DownloadData($root + $url)
    $charImg.Source = New-Bitmap $bytes
  } catch { $script:lastImg = "" }
}
function Set-ChatImage([string]$url) {
  if ($url -eq "" -or $url -eq $script:lastChat) { return }
  $script:lastChat = $url
  try {
    $bytes = $wc.DownloadData($root + $url)
    $chatImg.Source = New-Bitmap $bytes
  } catch { $script:lastChat = "" }
}
function Show-Menu {
  $menu = New-Object System.Windows.Controls.ContextMenu
  $chars = $script:state.characters
  if ($chars -ne $null) {
    foreach ($c in $chars) {
      $item = New-Object System.Windows.Controls.MenuItem
      $item.Header = [string]$c.name
      $item.Tag = [string]$c.folder
      $item.Add_Click({
        param($sender, $evt)
        $folder = $sender.Tag
        try { Invoke-RestMethod -Uri ($Api + "/select?folder=" + [uri]::EscapeDataString($folder)) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
      })
      [void]$menu.Items.Add($item)
    }
    $sep = New-Object System.Windows.Controls.Separator
    [void]$menu.Items.Add($sep)
  }
  $open = New-Object System.Windows.Controls.MenuItem
  $open.Header = "打开主界面"
  $open.Add_Click({ Open-Gui })
  [void]$menu.Items.Add($open)
  $win = New-Object System.Windows.Controls.MenuItem
  $win.Header = "关闭置顶小窗"
  $win.Add_Click({
    try { Invoke-RestMethod -Uri ($Api + "/window?enabled=0") -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
    $window.Close()
  })
  [void]$menu.Items.Add($win)
  $menu.Placement = [System.Windows.Controls.Primitives.PlacementMode]::MousePoint
  $menu.PlacementTarget = $window
  $menu.IsOpen = $true
}
$window.Add_MouseLeftButtonDown({
  param($s, $e)
  $dpiX = 1.0
  $dpiY = 1.0
  try { $d = [System.Windows.Media.VisualTreeHelper]::GetDpi($s); $dpiX = [double]$d.DpiScaleX; $dpiY = [double]$d.DpiScaleY } catch {}
  $p = $s.PointToScreen($e.GetPosition($s))
  $script:drag = @{ sx = $p.X; sy = $p.Y; fx = $s.Left; fy = $s.Top; dx = $dpiX; dy = $dpiY }
  [void]$s.CaptureMouse()
})
$window.Add_MouseMove({
  param($s, $e)
  if ($script:drag -ne $null) {
    $p = $s.PointToScreen($e.GetPosition($s))
    $s.Left = $script:drag.fx + ($p.X - $script:drag.sx) / $script:drag.dx
    $s.Top = $script:drag.fy + ($p.Y - $script:drag.sy) / $script:drag.dy
  }
})
$window.Add_MouseLeftButtonUp({
  param($s, $e)
  if ($script:drag -ne $null) {
    $script:drag = $null
    if ($s.IsMouseCaptured) { $s.ReleaseMouseCapture() }
    $g = [Math]::Max(0, $script:curOffset)
    try { Invoke-RestMethod -Uri ($Api + "/pos?x=" + [int]$s.Left + "&y=" + ([int]$s.Top + $g)) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}
  }
})
$window.Add_MouseRightButtonUp({ Show-Menu })
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(500)
$timer.Add_Tick({
  $script:tick++
  $s = Read-Json
  if ($null -eq $s) { return }
  $script:state = $s
  if ($s.image) { Set-CharImage ([string]$s.image) }
  if ($null -ne $s.chatOffset) { Apply-Offset ([int]$s.chatOffset) }
  if ($script:lastNotif -ne $null -and $script:lastNotif.kind -ne "question" -and $s.runningAgents -and @($s.runningAgents) -contains [string]$script:lastNotif.agentId) {
    Hide-Chat
  }
  if ($s.notifications -and $s.notifications.Count -gt 0) {
    $n = $s.notifications[$s.notifications.Count - 1]
    if ([int]$n.seq -gt $script:lastSeq) {
      $script:lastSeq = [int]$n.seq
      $script:lastNotif = $n
      if ($n.chatbox) { Set-ChatImage ([string]$n.chatbox) }
      $len = [int]$n.text.Length
      if ($len -ge 20) { $chatText.FontSize = 10 }
      elseif ($len -ge 12) { $chatText.FontSize = 12 }
      else { $chatText.FontSize = 14 }
      $chatText.Text = [string]$n.text
      $chatImg.Visibility = [System.Windows.Visibility]::Visible
      $chatText.Visibility = [System.Windows.Visibility]::Visible
      $viewLink.Visibility = [System.Windows.Visibility]::Visible
      $closeBtn.Visibility = [System.Windows.Visibility]::Visible
      $script:chatUntil = $script:tick + 120
    } elseif ($n.chatbox -ne $null -and [string]$n.chatbox -ne $script:lastChat) {
      $script:lastNotif = $n
      if ($n.chatbox) { Set-ChatImage ([string]$n.chatbox) }
    }
  }
  if ($script:chatUntil -gt 0 -and $script:tick -ge $script:chatUntil) {
    Hide-Chat
  }
})
$timer.Start()
$window.Show()
$app = New-Object System.Windows.Application
[void]$app.Run($window)

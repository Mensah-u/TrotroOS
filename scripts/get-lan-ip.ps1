# Best LAN IP for Expo Go QR (active adapter with default gateway, skip virtual NICs).
function Get-TrotroLanIp {
  try {
    $configs = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object {
      $_.NetAdapter.Status -eq 'Up' -and
      $_.IPv4Address -and
      $_.IPv4Address.IPAddress -notlike '127.*' -and
      $_.IPv4Address.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Hyper-V|Loopback|Teredo|Bluetooth'
    })

    $withGw = @($configs | Where-Object {
      $_.IPv4DefaultGateway -and
      $_.IPv4DefaultGateway.NextHop -and
      $_.IPv4DefaultGateway.NextHop -ne '0.0.0.0'
    })

    if ($withGw.Count -gt 0) {
      return $withGw[0].IPv4Address.IPAddress
    }
    if ($configs.Count -gt 0) {
      return $configs[0].IPv4Address.IPAddress
    }
  } catch {
    # fall through
  }
  return 'localhost'
}

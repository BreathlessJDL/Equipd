param(
  [string]$ProjectRef = "mhwvzovxlqimcuxvyyjf",
  [int]$Minutes = 30
)

$ErrorActionPreference = "Stop"

# Read the token already used by the authenticated Supabase CLI from Windows
# Credential Manager. The token is never printed or written to disk.
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class EquipdCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint = "CredReadW",
    CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(
    string target, uint type, int reservedFlag, out IntPtr credentialPtr);

  [DllImport("Advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr credential);

  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      CREDENTIAL credential =
        (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      byte[] bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return System.Text.Encoding.UTF8.GetString(bytes);
    } finally {
      CredFree(pointer);
    }
  }
}
"@

$token = [EquipdCredentialReader]::Read("Supabase CLI:supabase")
$end = (Get-Date).ToUniversalTime()
$start = $end.AddMinutes(-1 * $Minutes)
$baseUrl = "https://api.supabase.com/v1/projects/$ProjectRef/analytics/endpoints/logs"
$headers = @{ Authorization = "Bearer $token" }

function Invoke-LogQuery([string]$sql) {
  $encodedSql = [Uri]::EscapeDataString($sql)
  $encodedStart = [Uri]::EscapeDataString($start.ToString("o"))
  $encodedEnd = [Uri]::EscapeDataString($end.ToString("o"))
  $uri = "$baseUrl`?sql=$encodedSql&iso_timestamp_start=$encodedStart&iso_timestamp_end=$encodedEnd"
  Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}

$logs = Invoke-LogQuery @"
select
  timestamp,
  event_message,
  source,
  log_attributes
from logs
where source in ('function_logs', 'function_edge_logs')
order by timestamp desc
limit 200
"@

[pscustomobject]@{
  queried_at = $end.ToString("o")
  start_at = $start.ToString("o")
  logs = $logs
} | ConvertTo-Json -Depth 20


# Volume Control Script for Windows - Version simplifiée
# Utilise les cmdlets PowerShell natives

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("get", "set", "mute", "unmute", "toggle-mute")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [int]$Volume = -1
)

# Utiliser l'assembly Windows pour le contrôle audio
Add-Type -AssemblyName System.Windows.Forms

# Fonction pour envoyer des touches multimédia
function Send-VolumeKey {
    param([string]$Key)

    $code = switch ($Key) {
        "mute" { 0xAD }      # VK_VOLUME_MUTE
        "down" { 0xAE }      # VK_VOLUME_DOWN
        "up" { 0xAF }        # VK_VOLUME_UP
    }

    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class VolumeKeys {
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        public static void SendKey(byte key) {
            keybd_event(key, 0, 0, UIntPtr.Zero);
            keybd_event(key, 0, 2, UIntPtr.Zero); // KEYEVENTF_KEYUP
        }
    }
"@

    [VolumeKeys]::SendKey($code)
}

# Méthode alternative utilisant NAudio style COM
function Get-AudioVolume {
    try {
        # Utiliser WScript.Shell pour obtenir le volume via SendKeys
        # Cette méthode est moins précise mais plus compatible

        # Alternative: utiliser PowerShell 5+ avec Windows.Media
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class VolumeControl {
    [DllImport("winmm.dll")]
    public static extern int waveOutGetVolume(IntPtr hwo, out uint dwVolume);

    [DllImport("winmm.dll")]
    public static extern int waveOutSetVolume(IntPtr hwo, uint dwVolume);

    public static int GetVolume() {
        uint vol = 0;
        waveOutGetVolume(IntPtr.Zero, out vol);
        // Le volume est sur 16 bits pour chaque canal (gauche/droite)
        // On prend le canal gauche (bits 0-15)
        ushort left = (ushort)(vol & 0xFFFF);
        return (int)Math.Round((left / 65535.0) * 100);
    }

    public static void SetVolume(int level) {
        // Convertir 0-100 en 0-65535
        ushort vol = (ushort)(level / 100.0 * 65535);
        // Mettre le même volume sur les deux canaux
        uint combined = (uint)(vol | (vol << 16));
        waveOutSetVolume(IntPtr.Zero, combined);
    }
}
"@

        $vol = [VolumeControl]::GetVolume()
        return @{ volume = $vol; muted = $false }
    }
    catch {
        # Fallback: retourner une valeur par défaut
        return @{ volume = 50; muted = $false; error = $_.Exception.Message }
    }
}

function Set-AudioVolume {
    param([int]$Level)
    try {
        [VolumeControl]::SetVolume($Level)
        return @{ success = $true; volume = $Level }
    }
    catch {
        return @{ success = $false; error = $_.Exception.Message }
    }
}

try {
    switch ($Action) {
        "get" {
            $result = Get-AudioVolume
            $result | ConvertTo-Json
        }
        "set" {
            if ($Volume -ge 0 -and $Volume -le 100) {
                $result = Set-AudioVolume -Level $Volume
                $result | ConvertTo-Json
            } else {
                @{ success = $false; error = "Volume must be between 0 and 100" } | ConvertTo-Json
            }
        }
        "mute" {
            Send-VolumeKey -Key "mute"
            @{ success = $true; muted = $true } | ConvertTo-Json
        }
        "unmute" {
            Send-VolumeKey -Key "mute"
            @{ success = $true; muted = $false } | ConvertTo-Json
        }
        "toggle-mute" {
            Send-VolumeKey -Key "mute"
            @{ success = $true } | ConvertTo-Json
        }
    }
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}

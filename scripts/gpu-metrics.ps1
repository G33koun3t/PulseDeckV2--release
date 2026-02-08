param(
    [string]$Luid = ""
)

$result = @{
    utilization = 0
    vramUsed = 0
    temperature = -1
}

try {
    # GPU Utilization via 3D engine counters
    $engines = (Get-Counter '\GPU Engine(*engtype_3D*)\Utilization Percentage' -ErrorAction Stop).CounterSamples

    if ($Luid -ne "") {
        $filtered = $engines | Where-Object { $_.InstanceName -like "*$Luid*" }
        $result.utilization = [math]::Round(($filtered | Measure-Object -Property CookedValue -Sum).Sum, 1)
    } else {
        # Prendre le GPU avec la plus haute utilisation
        $grouped = $engines | Group-Object { [regex]::Match($_.InstanceName, 'luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+').Value }
        $maxUtil = 0
        foreach ($g in $grouped) {
            $util = ($g.Group | Measure-Object -Property CookedValue -Sum).Sum
            if ($util -gt $maxUtil) { $maxUtil = $util }
        }
        $result.utilization = [math]::Round($maxUtil, 1)
    }

    # VRAM via adapter memory
    $vram = (Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples
    if ($Luid -ne "") {
        $filtered = $vram | Where-Object { $_.InstanceName -like "*$Luid*" }
        $result.vramUsed = [math]::Round(($filtered | Measure-Object -Property CookedValue -Maximum).Maximum / 1MB, 0)
    } else {
        $result.vramUsed = [math]::Round(($vram | Measure-Object -Property CookedValue -Maximum).Maximum / 1MB, 0)
    }
} catch {
    # Counters not available
}

# Output as JSON
$result | ConvertTo-Json -Compress

Get-PSDrive -PSProvider FileSystem | Where-Object { $_.DisplayRoot -like '\\*' } | Select-Object Name, Used, Free, @{N='Size';E={$_.Used + $_.Free}}, DisplayRoot | ConvertTo-Json

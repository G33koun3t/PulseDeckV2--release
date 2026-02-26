use serde_json::Value;

#[cfg(windows)]
mod wasapi {
    use windows::Win32::Media::Audio::*;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::System::Com::*;
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::core::*;

    const PKEY_DEVICE_FRIENDLY_NAME: windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY =
        windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY {
            fmtid: GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
            pid: 14,
        };

    // Undocumented COM: IPolicyConfig IID & CPolicyConfigClient CLSID
    const IID_IPOLICYCONFIG: GUID = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
    const CLSID_CPOLICYCONFIGCLIENT: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

    fn init_com() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    fn get_default_endpoint() -> Result<IMMDevice> {
        init_com();
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
        }
    }

    fn get_volume_control() -> Result<IAudioEndpointVolume> {
        let device = get_default_endpoint()?;
        unsafe {
            device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
        }
    }

    pub fn get_volume() -> Result<(i32, bool)> {
        let volume_ctrl = get_volume_control()?;
        unsafe {
            let level = volume_ctrl.GetMasterVolumeLevelScalar()?;
            let muted = volume_ctrl.GetMute()?.as_bool();
            Ok(((level * 100.0).round() as i32, muted))
        }
    }

    pub fn set_volume(volume: i32) -> Result<()> {
        let volume_ctrl = get_volume_control()?;
        let level = (volume.clamp(0, 100) as f32) / 100.0;
        unsafe {
            volume_ctrl.SetMasterVolumeLevelScalar(level, std::ptr::null())
        }
    }

    pub fn get_muted() -> Result<bool> {
        let volume_ctrl = get_volume_control()?;
        unsafe {
            Ok(volume_ctrl.GetMute()?.as_bool())
        }
    }

    pub fn set_muted(muted: bool) -> Result<()> {
        let volume_ctrl = get_volume_control()?;
        unsafe {
            volume_ctrl.SetMute(muted, std::ptr::null())
        }
    }

    /// Set default audio output device via undocumented IPolicyConfig COM interface.
    /// Uses raw vtable calls since IPolicyConfig is not in the Windows metadata.
    ///
    /// IPolicyConfig vtable (after IUnknown 0-2):
    ///   3: GetMixFormat, 4: GetDeviceFormat, 5: ResetDeviceFormat,
    ///   6: SetDeviceFormat, 7: GetProcessingPeriod, 8: SetProcessingPeriod,
    ///   9: GetShareMode, 10: SetShareMode, 11: GetPropertyValue,
    ///   12: SetPropertyValue, 13: SetDefaultEndpoint, 14: SetEndpointVisibility
    pub fn set_default_device(device_id: &str) -> std::result::Result<(), String> {
        unsafe {
            init_com();

            // CoCreateInstance → raw pointer for undocumented IPolicyConfig
            let mut policy_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
            let hr = windows::Win32::System::Com::CoCreateInstance(
                &CLSID_CPOLICYCONFIGCLIENT,
                None,
                CLSCTX_ALL,
            );

            let unk: IUnknown = hr.map_err(|e| format!("CoCreateInstance CPolicyConfigClient: {}", e))?;

            // QueryInterface for IPolicyConfig
            (unk.vtable().QueryInterface)(
                std::mem::transmute_copy(&unk),
                &IID_IPOLICYCONFIG,
                &mut policy_ptr,
            )
            .ok()
            .map_err(|e| format!("QueryInterface IPolicyConfig: {}", e))?;

            if policy_ptr.is_null() {
                return Err("IPolicyConfig pointer is null".into());
            }

            // Read vtable pointer from the COM object
            let vtable = *(policy_ptr as *const *const usize);

            // SetDefaultEndpoint is at vtable index 13
            // Signature: HRESULT(this, LPCWSTR deviceId, ERole role)
            type SetDefaultEndpointFn = unsafe extern "system" fn(
                this: *mut std::ffi::c_void,
                psz_device_name: *const u16,
                role: i32,
            ) -> HRESULT;

            let set_default_fn: SetDefaultEndpointFn =
                std::mem::transmute(*(vtable.add(13) as *const usize));

            // Encode device ID as null-terminated UTF-16
            let wide_id: Vec<u16> = device_id.encode_utf16().chain(std::iter::once(0)).collect();
            let id_ptr = wide_id.as_ptr();

            // Set for all 3 roles: eConsole=0, eMultimedia=1, eCommunications=2
            let hr0 = set_default_fn(policy_ptr, id_ptr, 0);
            let hr1 = set_default_fn(policy_ptr, id_ptr, 1);
            let hr2 = set_default_fn(policy_ptr, id_ptr, 2);

            // Release the IPolicyConfig pointer
            type ReleaseFn = unsafe extern "system" fn(this: *mut std::ffi::c_void) -> u32;
            let release_fn: ReleaseFn = std::mem::transmute(*(vtable.add(2) as *const usize));
            release_fn(policy_ptr);

            if hr0.is_ok() && hr1.is_ok() && hr2.is_ok() {
                Ok(())
            } else {
                Err(format!(
                    "SetDefaultEndpoint HRESULT: console=0x{:08X}, multimedia=0x{:08X}, comm=0x{:08X}",
                    hr0.0 as u32, hr1.0 as u32, hr2.0 as u32
                ))
            }
        }
    }

    pub fn list_audio_devices() -> Result<Vec<serde_json::Value>> {
        init_com();
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

            // Get default device ID
            let default_id = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .and_then(|d| d.GetId())
                .ok()
                .and_then(|id| id.to_string().ok())
                .unwrap_or_default();

            // Enumerate active render devices
            let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
            let count = collection.GetCount()?;

            let mut devices = Vec::new();
            for i in 0..count {
                if let Ok(device) = collection.Item(i) {
                    let id = device.GetId()
                        .ok()
                        .and_then(|id| id.to_string().ok())
                        .unwrap_or_default();

                    let name = get_device_name(&device).unwrap_or_else(|| "Unknown Device".into());
                    let is_default = id == default_id;

                    devices.push(serde_json::json!({
                        "id": id,
                        "name": name,
                        "isDefault": is_default,
                    }));
                }
            }

            Ok(devices)
        }
    }

    unsafe fn get_device_name(device: &IMMDevice) -> Option<String> {
        let store: IPropertyStore = device.OpenPropertyStore(STGM_READ).ok()?;
        let prop = store.GetValue(&PKEY_DEVICE_FRIENDLY_NAME).ok()?;
        use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
        let pwstr = PropVariantToStringAlloc(&prop).ok()?;
        let name = pwstr.to_string().ok()?;
        Some(name)
    }
}

#[tauri::command]
pub async fn get_volume() -> Result<Value, String> {
    #[cfg(windows)]
    {
        let result = tokio::task::spawn_blocking(|| {
            wasapi::get_volume().map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(serde_json::json!({
            "volume": result.0,
            "muted": result.1,
        }))
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "volume": 0, "muted": false }))
    }
}

#[tauri::command]
pub async fn set_volume(volume: i32) -> Result<Value, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(move || {
            wasapi::set_volume(volume).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(serde_json::json!({ "success": true, "volume": volume }))
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "success": false }))
    }
}

#[tauri::command]
pub async fn toggle_mute() -> Result<Value, String> {
    #[cfg(windows)]
    {
        let muted = tokio::task::spawn_blocking(|| {
            let current = wasapi::get_muted().map_err(|e| e.to_string())?;
            wasapi::set_muted(!current).map_err(|e| e.to_string())?;
            Ok::<bool, String>(!current)
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(serde_json::json!({ "success": true, "muted": muted }))
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "success": false }))
    }
}

#[tauri::command]
pub async fn set_mute(muted: bool) -> Result<Value, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(move || {
            wasapi::set_muted(muted).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(serde_json::json!({ "success": true, "muted": muted }))
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "success": false }))
    }
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Value, String> {
    #[cfg(windows)]
    {
        let devices = tokio::task::spawn_blocking(|| {
            wasapi::list_audio_devices().map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(serde_json::json!({
            "success": true,
            "devices": devices,
        }))
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "success": false, "devices": [] }))
    }
}

#[tauri::command]
pub async fn set_audio_device(device_id: String) -> Result<Value, String> {
    #[cfg(windows)]
    {
        let result = tokio::task::spawn_blocking(move || {
            wasapi::set_default_device(&device_id)
        })
        .await
        .map_err(|e| e.to_string())?;

        match result {
            Ok(()) => Ok(serde_json::json!({ "success": true })),
            Err(e) => Ok(serde_json::json!({ "success": false, "error": e })),
        }
    }
    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "success": false, "error": "Not supported on this platform" }))
    }
}

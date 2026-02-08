param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("list", "set")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$DeviceId = ""
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

[StructLayout(LayoutKind.Sequential)]
public struct PROPERTYKEY {
    public Guid fmtid;
    public uint pid;
}

[StructLayout(LayoutKind.Sequential)]
public struct PROPVARIANT {
    public ushort vt;
    public ushort wReserved1;
    public ushort wReserved2;
    public ushort wReserved3;
    public IntPtr pointerValue;
    public IntPtr pointerValue2;
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    [PreserveSig] int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    [PreserveSig] int GetState(out int pdwState);
}

[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out uint pcDevices);
    [PreserveSig] int Item(uint nDevice, out IMMDevice ppDevice);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
}

[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
    [PreserveSig] int GetCount(out uint cProps);
    [PreserveSig] int GetAt(uint iProp, out PROPERTYKEY pkey);
    [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT propvar);
    [PreserveSig] int Commit();
}

[Guid("f8679f50-850a-41cf-9c72-430f290290c8"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPolicyConfig {
    [PreserveSig] int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr ppFormat);
    [PreserveSig] int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, int bDefault, IntPtr ppFormat);
    [PreserveSig] int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName);
    [PreserveSig] int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pEndpointFormat, IntPtr mixFormat);
    [PreserveSig] int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, int bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    [PreserveSig] int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pmftPeriod);
    [PreserveSig] int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pMode);
    [PreserveSig] int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr mode);
    [PreserveSig] int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, int bFx, IntPtr pKey, IntPtr pValue);
    [PreserveSig] int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, int bFx, IntPtr pKey, IntPtr pValue);
    [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.I4)] int role);
    [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, int bVisible);
}

[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
public class CPolicyConfigClient { }

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorClass { }

public class AudioDeviceManager {
    private static PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
        fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
        pid = 14
    };

    public static string ListDevices() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorClass());

        string defaultId = "";
        IMMDevice defaultDevice;
        int hr = enumerator.GetDefaultAudioEndpoint(0, 0, out defaultDevice);
        if (hr == 0 && defaultDevice != null) {
            defaultDevice.GetId(out defaultId);
        }

        IMMDeviceCollection collection;
        enumerator.EnumAudioEndpoints(0, 1, out collection);

        uint count;
        collection.GetCount(out count);

        var results = new List<string>();

        for (uint i = 0; i < count; i++) {
            IMMDevice device;
            collection.Item(i, out device);

            string id;
            device.GetId(out id);

            IPropertyStore props;
            device.OpenPropertyStore(0, out props);

            PROPVARIANT nameVar;
            props.GetValue(ref PKEY_Device_FriendlyName, out nameVar);
            string name = Marshal.PtrToStringUni(nameVar.pointerValue);
            if (string.IsNullOrEmpty(name)) name = "Unknown Device";

            bool isDefault = (id == defaultId);

            string safeId = id.Replace("\\", "\\\\").Replace("\"", "\\\"");
            string safeName = name.Replace("\\", "\\\\").Replace("\"", "\\\"");

            results.Add(string.Format(
                "{{\"id\":\"{0}\",\"name\":\"{1}\",\"isDefault\":{2}}}",
                safeId, safeName, isDefault ? "true" : "false"
            ));
        }

        return "[" + string.Join(",", results.ToArray()) + "]";
    }

    public static string SetDefaultDevice(string deviceId) {
        try {
            var policyConfig = (IPolicyConfig)(new CPolicyConfigClient());

            int hr0 = policyConfig.SetDefaultEndpoint(deviceId, 0); // eConsole
            int hr1 = policyConfig.SetDefaultEndpoint(deviceId, 1); // eMultimedia
            int hr2 = policyConfig.SetDefaultEndpoint(deviceId, 2); // eCommunications

            if (hr0 == 0 && hr1 == 0 && hr2 == 0) {
                return "{\"success\":true}";
            } else {
                return string.Format(
                    "{{\"success\":false,\"error\":\"HRESULT: console=0x{0:X8}, multimedia=0x{1:X8}, comm=0x{2:X8}\"}}",
                    hr0, hr1, hr2
                );
            }
        } catch (Exception ex) {
            string msg = ex.Message.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
            return string.Format("{{\"success\":false,\"error\":\"{0}\"}}", msg);
        }
    }
}
"@

try {
    switch ($Action) {
        "list" {
            $result = [AudioDeviceManager]::ListDevices()
            $result
        }
        "set" {
            if ([string]::IsNullOrEmpty($DeviceId)) {
                '{"success":false,"error":"DeviceId is required"}'
            } else {
                $result = [AudioDeviceManager]::SetDefaultDevice($DeviceId)
                $result
            }
        }
    }
} catch {
    $errorMsg = $_.Exception.Message -replace '"', '\"'
    "{`"success`":false,`"error`":`"$errorMsg`"}"
}

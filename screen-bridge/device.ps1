param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("wifi", "bluetooth", "volume", "brightness")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$Value
)

$ErrorActionPreference = "Stop"

function Get-EnabledValue([string]$Raw) {
    switch ($Raw.Trim().ToLowerInvariant()) {
        "true"  { return $true }
        "1"     { return $true }
        "on"    { return $true }
        "false" { return $false }
        "0"     { return $false }
        "off"   { return $false }
        default { throw "expected on/off value" }
    }
}

function Get-LevelValue([string]$Raw) {
    $level = 0
    if (-not [int]::TryParse($Raw, [ref]$level)) {
        throw "expected numeric level"
    }
    if ($level -lt 0 -or $level -gt 100) {
        throw "level must be between 0 and 100"
    }
    return $level
}

switch ($Action) {
    'wifi' {
        $enabled = Get-EnabledValue $Value
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $r = [Windows.Devices.Radios.Radio,Windows.Devices.Radios,ContentType=WindowsRuntime]
        $m = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' } | Select-Object -First 1
        if (!$m) { throw 'Radio API unavailable' }
        $access = $r::RequestAccessAsync()
        $t = $m.MakeGenericMethod($r.GetMethod('RequestAccessAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($access))
        $t.Wait()
        if ($t.Result -ne 'Allowed') { throw 'Radio access denied' }
        $op = $r::GetRadiosAsync()
        $t = $m.MakeGenericMethod($r.GetMethod('GetRadiosAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($op))
        $t.Wait()
        $radio = $t.Result | Where-Object { $_.Kind -eq 'WiFi' } | Select-Object -First 1
        if (!$radio) { throw 'WiFi radio not found' }
        $state = if ($enabled) { [Windows.Devices.Radios.RadioState,Windows.Devices.Radios,ContentType=WindowsRuntime]::On } else { [Windows.Devices.Radios.RadioState,Windows.Devices.Radios,ContentType=WindowsRuntime]::Off }
        $op = $radio.SetStateAsync($state)
        $t = $m.MakeGenericMethod($r.GetMethod('SetStateAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($op))
        $t.Wait()
        if ($t.Result -ne 'Allowed') { throw 'WiFi switch refused' }
        if ($enabled) { 'Wi-Fi ON' } else { 'Wi-Fi OFF' }
        break
    }

    'bluetooth' {
        $enabled = Get-EnabledValue $Value
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $r = [Windows.Devices.Radios.Radio,Windows.Devices.Radios,ContentType=WindowsRuntime]
        $m = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' } | Select-Object -First 1
        if (!$m) { throw 'Radio API unavailable' }
        $access = $r::RequestAccessAsync()
        $t = $m.MakeGenericMethod($r.GetMethod('RequestAccessAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($access))
        $t.Wait()
        if ($t.Result -ne 'Allowed') { throw 'Radio access denied' }
        $op = $r::GetRadiosAsync()
        $t = $m.MakeGenericMethod($r.GetMethod('GetRadiosAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($op))
        $t.Wait()
        $radio = $t.Result | Where-Object { $_.Kind -eq 'Bluetooth' } | Select-Object -First 1
        if (!$radio) { throw 'Bluetooth radio not found' }
        $state = if ($enabled) { [Windows.Devices.Radios.RadioState,Windows.Devices.Radios,ContentType=WindowsRuntime]::On } else { [Windows.Devices.Radios.RadioState,Windows.Devices.Radios,ContentType=WindowsRuntime]::Off }
        $op = $radio.SetStateAsync($state)
        $t = $m.MakeGenericMethod($r.GetMethod('SetStateAsync').ReturnType.GenericTypeArguments[0]).Invoke($null,@($op))
        $t.Wait()
        if ($t.Result -ne 'Allowed') { throw 'Bluetooth switch refused' }
        if ($enabled) { 'Bluetooth ON' } else { 'Bluetooth OFF' }
        break
    }

    "brightness" {
        $level = Get-LevelValue $Value
        $method = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop |
            Select-Object -First 1

        if (-not $method) {
            throw "brightness control is not available"
        }

        Invoke-CimMethod -InputObject $method -MethodName WmiSetBrightness -Arguments @{
            Timeout = [uint32]1
            Brightness = [byte]$level
        } | Out-Null

        "Brightness $level%"
        break
    }

    "volume" {
        $level = Get-LevelValue $Value

        if (-not ("DinsCoreAudio" -as [type])) {
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class DinsCoreAudio
{
    private enum EDataFlow
    {
        eRender,
        eCapture,
        eAll
    }

    private enum ERole
    {
        eConsole,
        eMultimedia,
        eCommunications
    }

    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumerator
    {
    }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig]
        int EnumAudioEndpoints(EDataFlow dataFlow, uint stateMask, out IntPtr devices);

        [PreserveSig]
        int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice device);
    }

    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig]
        int Activate(
            ref Guid iid,
            uint clsCtx,
            IntPtr activationParams,
            [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
    }

    [ComImport]
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr notify);
        int UnregisterControlChangeNotify(IntPtr notify);
        int GetChannelCount(out uint channelCount);
        int SetMasterVolumeLevel(float levelDb, Guid eventContext);
        int SetMasterVolumeLevelScalar(float level, Guid eventContext);
    }

    public static void SetVolume(float level)
    {
        if (level < 0.0f || level > 1.0f)
            throw new ArgumentOutOfRangeException("level");

        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDevice device;
        int hr = enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device);
        if (hr != 0)
            Marshal.ThrowExceptionForHR(hr);

        Guid iid = typeof(IAudioEndpointVolume).GUID;
        object endpointObject;
        hr = device.Activate(ref iid, 23, IntPtr.Zero, out endpointObject);
        if (hr != 0)
            Marshal.ThrowExceptionForHR(hr);

        IAudioEndpointVolume endpoint = (IAudioEndpointVolume)endpointObject;
        hr = endpoint.SetMasterVolumeLevelScalar(level, Guid.Empty);
        if (hr != 0)
            Marshal.ThrowExceptionForHR(hr);

        Marshal.ReleaseComObject(endpoint);
        Marshal.ReleaseComObject(device);
        Marshal.ReleaseComObject(enumerator);
    }
}
'@
        }

        [DinsCoreAudio]::SetVolume([single]($level / 100.0))
        "Volume $level%"
        break
    }
}

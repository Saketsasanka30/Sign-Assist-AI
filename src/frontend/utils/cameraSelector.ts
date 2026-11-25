export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  isPhoneOrVirtual: boolean;
  isBuiltInPreferred: boolean;
}

const PHONE_OR_VIRTUAL_PATTERN =
  /(iphone|ipad|android|phone|continuity|desk view|link to windows|phone link|camo|iriun|droidcam|epoccam|ivcam|obs|snap camera|virtual|ndi|manycam)/i;

const BUILT_IN_LAPTOP_PATTERN =
  /(integrated|facetime|built-in|internal|laptop|webcam|hd camera|hd webcam|usb2\.0|chicony|bison|realtek|sunplus|macbook|acer|asus|lenovo|dell|hp|front camera|user facing)/i;

export function isPhoneOrVirtualCamera(label: string): boolean {
  return PHONE_OR_VIRTUAL_PATTERN.test(label);
}

function scoreCameraDevice(device: MediaDeviceInfo, index: number): number {
  const label = device.label || "";
  if (PHONE_OR_VIRTUAL_PATTERN.test(label)) return -1000 - index;
  if (BUILT_IN_LAPTOP_PATTERN.test(label)) return 500 - index;
  return 100 - index;
}

export async function listCameraDevices(): Promise<CameraDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  return videoInputs
    .map((d, idx) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${idx + 1}`,
      isPhoneOrVirtual: isPhoneOrVirtualCamera(d.label || ""),
      isBuiltInPreferred: BUILT_IN_LAPTOP_PATTERN.test(d.label || ""),
    }))
    .sort((a, b) => {
      const aScore = a.isPhoneOrVirtual ? -100 : a.isBuiltInPreferred ? 100 : 10;
      const bScore = b.isPhoneOrVirtual ? -100 : b.isBuiltInPreferred ? 100 : 10;
      return bScore - aScore;
    });
}

export interface OpenedCameraResult {
  stream: MediaStream;
  activeDeviceId: string;
  activeLabel: string;
  cameras: CameraDeviceInfo[];
}

/**
 * Opens the device's built-in laptop camera and explicitly avoids linked phone / Continuity / virtual cameras.
 */
export async function openLocalDeviceCamera(
  preferredDeviceId?: string
): Promise<OpenedCameraResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }

  // If caller explicitly selected a specific deviceId, open it directly
  if (preferredDeviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: preferredDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    const cameras = await listCameraDevices();
    return {
      stream,
      activeDeviceId: track?.getSettings().deviceId || preferredDeviceId,
      activeLabel: track?.label || "Local Camera",
      cameras,
    };
  }

  // Check if labels are already visible before opening stream
  const preDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "videoinput"
  );
  const labelsAvailable = preDevices.some((d) => d.label && d.label.trim().length > 0);

  if (labelsAvailable && preDevices.length > 0) {
    const sorted = [...preDevices].sort(
      (a, b) => scoreCameraDevice(b, preDevices.indexOf(b)) - scoreCameraDevice(a, preDevices.indexOf(a))
    );
    const best = sorted[0];

    if (best && !isPhoneOrVirtualCamera(best.label)) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: best.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const cameras = await listCameraDevices();
      return {
        stream,
        activeDeviceId: track?.getSettings().deviceId || best.deviceId,
        activeLabel: track?.label || best.label || "Built-in Camera",
        cameras,
      };
    }
  }

  // Request permission first with user-facing constraint
  let stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });

  let track = stream.getVideoTracks()[0];
  let activeLabel = track?.label || "";
  let activeDeviceId = track?.getSettings().deviceId || "";

  // Re-enumerate now that permission is granted and labels are unlocked
  const postDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "videoinput"
  );

  // If browser picked a linked phone / Continuity / virtual camera, switch immediately to local webcam
  if (isPhoneOrVirtualCamera(activeLabel) || postDevices.length > 1) {
    const sorted = [...postDevices].sort(
      (a, b) => scoreCameraDevice(b, postDevices.indexOf(b)) - scoreCameraDevice(a, postDevices.indexOf(a))
    );
    const localBest = sorted.find((d) => !isPhoneOrVirtualCamera(d.label));

    if (localBest && localBest.deviceId && localBest.deviceId !== activeDeviceId) {
      stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: localBest.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      track = stream.getVideoTracks()[0];
      activeLabel = track?.label || localBest.label || "Built-in Camera";
      activeDeviceId = track?.getSettings().deviceId || localBest.deviceId;
    }
  }

  const cameras = await listCameraDevices();
  return {
    stream,
    activeDeviceId,
    activeLabel: activeLabel || "Built-in Camera",
    cameras,
  };
}

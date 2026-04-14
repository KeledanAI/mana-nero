import QRCode from "qrcode";

type Props = {
  checkInUrl: string;
  label?: string;
};

export async function EventCheckInQr({ checkInUrl, label }: Props) {
  const dataUrl = await QRCode.toDataURL(checkInUrl, {
    width: 168,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {/* Data URL generato lato server: next/image non applicabile senza loader custom. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- QR inline da qrcode */}
      <img
        src={dataUrl}
        width={168}
        height={168}
        alt="QR code per check-in"
        className="rounded-lg border border-border/60 bg-white p-1"
      />
      {label ? <p className="max-w-[200px] text-xs text-foreground/60">{label}</p> : null}
    </div>
  );
}

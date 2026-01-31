
import React, { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './UI';
import { Driver } from '../types';
import QRCode from 'qrcode';

interface BadgeProps {
  driver: Driver;
}

export const Badge: React.FC<BadgeProps> = ({ driver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  };

  const drawBadge = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 1150;
    canvas.width = width;
    canvas.height = height;

    const brandBlue = '#2563eb';
    const palette = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8'];

    // 1. Fondo Blanco Base
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 2. Fondo Geométrico de Triángulos
    const drawGeometricBg = () => {
      const gridSize = 70;
      ctx.save();
      for (let x = 0; x <= width; x += gridSize) {
        for (let y = 0; y <= height; y += gridSize) {
          const distToCenterX = Math.abs(x - width / 2) / (width / 2);
          const distToCenterY = Math.abs(y - height / 2) / (height / 2);
          const edgeWeight = Math.max(distToCenterX, distToCenterY);
          if (Math.random() > (1.1 - edgeWeight)) {
            const alpha = Math.random() * 0.12 * edgeWeight;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
            ctx.beginPath();
            const variant = Math.floor(Math.random() * 4);
            if (variant === 0) { ctx.moveTo(x, y); ctx.lineTo(x + gridSize, y); ctx.lineTo(x, y + gridSize); }
            else if (variant === 1) { ctx.moveTo(x + gridSize, y); ctx.lineTo(x + gridSize, y + gridSize); ctx.lineTo(x, y); }
            else if (variant === 2) { ctx.moveTo(x, y + gridSize); ctx.lineTo(x, y); ctx.lineTo(x + gridSize, y + gridSize); }
            else { ctx.moveTo(x + gridSize, y + gridSize); ctx.lineTo(x, y + gridSize); ctx.lineTo(x + gridSize, y); }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      ctx.restore();
    };
    drawGeometricBg();

    ctx.strokeStyle = brandBlue;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, width - 14, height - 14);

    const footerH = 85;
    ctx.fillStyle = brandBlue;
    ctx.fillRect(0, height - footerH, width, footerH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = "3px";
    ctx.fillText('IDENTIFICACIÓN OFICIAL SMART GO LOGÍSTICA', width / 2, height - 35);

    // 3. Logo
    const centerX = width / 2;
    const logoY = 65;
    ctx.save();
    ctx.fillStyle = brandBlue;
    ctx.beginPath();
    ctx.roundRect(centerX - 70, logoY - 8, 32, 3, 2);
    ctx.roundRect(centerX - 62, logoY + 1, 28, 3, 2);
    ctx.roundRect(centerX - 76, logoY + 10, 40, 3, 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 62px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', centerX - 30, logoY + 38);
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MART', centerX + 5, logoY + 36);
    ctx.fillStyle = brandBlue;
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText('GO', centerX + 50, logoY - 2);
    ctx.fillStyle = '#475569';
    ctx.font = '800 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = "5px";
    ctx.fillText('LOGÍSTICA', centerX + 5, logoY + 70);
    ctx.restore();

    // 4. QR y Foto - Sincronizamos con qrCodeKey
    const qrData = driver.qrCodeKey || `SG-ID-${driver.id}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, { 
        margin: 1, 
        width: 400,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const promises: Promise<HTMLImageElement | null>[] = [
        loadImage(qrDataUrl),
        driver.photoUrl ? loadImage(driver.photoUrl).catch(() => null) : Promise.resolve(null)
      ];

      const [qrImg, photoImg] = await Promise.all(promises);

      const photoRadius = 140;
      const photoY = 295;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(centerX, photoY, photoRadius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (photoImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, photoY, photoRadius, 0, Math.PI * 2);
        ctx.clip();
        const scale = Math.max(photoRadius * 2 / photoImg.width, photoRadius * 2 / photoImg.height);
        const x = centerX - (photoImg.width * scale) / 2;
        const y = photoY - (photoImg.height * scale) / 2;
        ctx.drawImage(photoImg, x, y, photoImg.width * scale, photoImg.height * scale);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(centerX, photoY, photoRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 110px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.fullName?.charAt(0).toUpperCase() || '?', centerX, photoY);
      }
      ctx.strokeStyle = brandBlue;
      ctx.lineWidth = 8;
      ctx.stroke();

      let currentY = 490;
      const fullName = driver.fullName?.toUpperCase() || 'OPERADOR';
      let fontSize = 44;
      ctx.font = `bold ${fontSize}px Inter`;
      while (ctx.measureText(fullName).width > width - 160 && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px Inter`;
      }
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(fullName, centerX, currentY);

      ctx.fillStyle = brandBlue;
      ctx.fillRect(centerX - 90, currentY + 15, 180, 4);

      const drawData = (label: string, value: string, y: number) => {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.03)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(160, y - 24, width - 320, 54, 10);
        else ctx.rect(160, y - 24, width - 320, 54);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 13px Inter';
        ctx.fillText(label, centerX, y - 5);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(value || '---', centerX, y + 24);
      };

      currentY += 90;
      drawData('CURP', driver.curp || '---', currentY);
      drawData('RFC', driver.rfc || '---', currentY + 70);
      drawData('NSS', driver.nss || '---', currentY + 140);

      const qrSize = 220;
      const qrY = 820;
      if (qrImg) {
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.05)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(centerX - (qrSize / 2) - 15, qrY - 15, qrSize + 30, qrSize + 40, 16);
        else ctx.rect(centerX - (qrSize / 2) - 15, qrY - 15, qrSize + 30, qrSize + 40);
        ctx.fill();
        ctx.restore();
        ctx.drawImage(qrImg, centerX - qrSize / 2, qrY, qrSize, qrSize);
        ctx.fillStyle = brandBlue;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(qrData.toUpperCase(), centerX, qrY + qrSize + 15);
      }
    } catch (err) {
      console.error("Error al generar componentes del gafete:", err);
    }
  };

  useEffect(() => {
    drawBadge();
  }, [driver]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `GAFETE_${driver.fullName?.replace(/\s/g, '_') || 'OPERADOR'}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-6 p-2 max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="rounded-[2.5rem] overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border-4 border-white/10 bg-white">
        <canvas ref={canvasRef} className="max-w-full h-auto w-[320px] md:w-[360px] block" />
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[360px] pb-6">
        <Button onClick={handleDownload} variant="primary" className="w-full py-5 uppercase font-black tracking-widest text-[10px] shadow-2xl bg-blue-600 hover:bg-blue-500">
          Descargar Gafete Digital
        </Button>
        <p className="text-[8px] text-center font-bold theme-text-muted uppercase tracking-[0.2em] opacity-60">
          Patrón Geométrico Certificado • Smart Go
        </p>
      </div>
    </div>
  );
};

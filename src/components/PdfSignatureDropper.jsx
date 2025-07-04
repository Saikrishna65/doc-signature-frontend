import React, { useContext, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.entry";
import SignatureCanvas from "react-signature-canvas";
import "@fontsource/dancing-script";
import "@fontsource/satisfy";
import "@fontsource/pacifico";
import "@fontsource/great-vibes";
import "@fontsource/alex-brush";
import "@fontsource/marck-script";
import html2canvas from "html2canvas";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import { AppContext } from "../context/AppContext";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

const FONT_OPTIONS = [
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Pacifico", value: "Pacifico" },
  { label: "Satisfy", value: "Satisfy" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Alex Brush", value: "Alex Brush" },
  { label: "Marck Script", value: "Marck Script" },
];

const PdfSignatureDropper = () => {
  const location = useLocation();
  const fileUrl = location.state?.fileUrl;

  if (!fileUrl) {
    return <div className="p-4">No PDF provided. Please upload one first.</div>;
  }

  const { backendUrl } = useContext(AppContext);

  const containerRef = useRef(null);
  const sigCanvasRef = useRef(null);
  const [signature, setSignature] = useState("");
  const [font, setFont] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(20);
  const [color, setColor] = useState("#000000");
  const [opacity, setOpacity] = useState(1);
  const [drawMode, setDrawMode] = useState(false);
  const [coords, setCoords] = useState([]);
  const [drawnDataURL, setDrawnDataURL] = useState("");
  const [activePage, setActivePage] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [pageSizes, setPageSizes] = useState([]);

  const handleGenerateImage = () => {
    if (sigCanvasRef.current) {
      const url = sigCanvasRef.current.getCanvas().toDataURL("image/png");
      setDrawnDataURL(url);
    }
  };

  const getSignatureImage = async (element) => {
    const clone = element.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.zIndex = "-9999";
    clone.style.pointerEvents = "none";
    clone.style.opacity = "1";
    clone.style.padding = "8px";
    clone.style.background = "transparent";
    clone.style.lineHeight = "1.5";
    clone.style.boxSizing = "content-box";

    document.body.appendChild(clone);
    await document.fonts.ready;

    const imgs = clone.querySelectorAll("img");
    await Promise.all(
      Array.from(imgs).map(
        (img) =>
          new Promise((res) => {
            if (img.complete) return res();
            img.onload = res;
            img.onerror = res;
          })
      )
    );

    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
    });

    document.body.removeChild(clone);
    return canvas.toDataURL("image/png");
  };

  const handleDragStart = async (e) => {
    if (drawMode) {
      if (!drawnDataURL && sigCanvasRef.current) {
        const url = sigCanvasRef.current.getCanvas().toDataURL("image/png");
        setDrawnDataURL(url);
        e.dataTransfer.setData("text/plain", "drawn:" + url);
      } else {
        e.dataTransfer.setData("text/plain", "drawn:" + drawnDataURL);
      }
    } else {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          type: "typed",
          text: signature,
          font,
          fontSize,
          color,
          opacity,
        })
      );
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(backendUrl + "/api/sign-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, coords }),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signed.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Error downloading PDF");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();

    const wrappers = containerRef.current.querySelectorAll(".canvas-wrapper");
    const wrapper = wrappers[activePage];
    if (!wrapper) return;

    const canvasImg = wrapper.querySelector("img");
    if (!canvasImg) return;

    const rect = canvasImg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    const normX = xPx / canvasImg.offsetWidth;
    const normY = yPx / canvasImg.offsetHeight;

    const data = e.dataTransfer.getData("text/plain");
    let imageBase64 = "";

    // Create temp DOM element to render to image
    const sig = document.createElement("div");
    sig.style.position = "absolute";
    sig.style.left = "-9999px";
    sig.style.top = "-9999px";
    sig.style.opacity = 1;
    sig.style.padding = "8px";
    sig.style.background = "transparent";

    if (data.startsWith("drawn:")) {
      imageBase64 = data.replace("drawn:", "");

      const img = document.createElement("img");
      img.src = imageBase64;
      img.style.width = `${fontSize * 4}px`; // scale factor
      img.style.opacity = opacity;
      sig.appendChild(img);
    } else {
      const {
        text,
        font: f,
        fontSize: fs,
        color: c,
        opacity: op,
      } = JSON.parse(data);

      sig.style.fontFamily = f;
      sig.style.fontSize = `${fs}px`;
      sig.style.color = c;
      sig.style.opacity = op;
      sig.textContent = text;
    }

    document.body.appendChild(sig);

    // Wait for fonts/images to load
    await document.fonts.ready;

    const canvas = await html2canvas(sig, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });

    imageBase64 = canvas.toDataURL("image/png");
    document.body.removeChild(sig);

    // Measure size again
    const measure = document.createElement("img");
    measure.src = imageBase64;
    measure.style.position = "absolute";
    measure.style.left = "-9999px";
    measure.style.top = "-9999px";
    document.body.appendChild(measure);

    await new Promise((resolve) => {
      measure.onload = resolve;
      measure.onerror = resolve;
    });

    const sigPxW = measure.offsetWidth;
    const sigPxH = measure.offsetHeight;
    document.body.removeChild(measure);

    const id = Date.now() + Math.random();
    setCoords((prev) => [
      ...prev,
      {
        id,
        page: activePage,
        imageBase64,
        x: normX,
        y: normY,
        width: sigPxW / canvasImg.offsetWidth,
        height: sigPxH / canvasImg.offsetHeight,
        opacity,
      },
    ]);
  };

  const startDrag = (e, id) => {
    e.stopPropagation();
    const sigElem = e.currentTarget;
    const wrapper = sigElem.parentElement;
    const rect = wrapper.getBoundingClientRect();
    const offsetX = e.clientX - sigElem.getBoundingClientRect().left;
    const offsetY = e.clientY - sigElem.getBoundingClientRect().top;

    const onMouseMove = (eMove) => {
      let x = eMove.clientX - rect.left - offsetX;
      let y = eMove.clientY - rect.top - offsetY;
      x = Math.max(0, Math.min(x, rect.width - sigElem.offsetWidth));
      y = Math.max(0, Math.min(y, rect.height - sigElem.offsetHeight));
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;
      setCoords((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, x: normalizedX, y: normalizedY } : c
        )
      );
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const removeSignature = (id) => {
    setCoords((prev) => prev.filter((c) => c.id !== id));
    setEditingId(null);
  };

  const renderPDFAsImage = async () => {
    if (!fileUrl) return;

    const loadingTask = pdfjsLib.getDocument(fileUrl);
    const pdf = await loadingTask.promise;
    const container = containerRef.current;
    container.innerHTML = "";

    const sizes = [];
    const thumbs = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Render at scale = 1 for exact PDF size
      const viewport = page.getViewport({ scale: 0.9 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const imageURL = canvas.toDataURL("image/png");
      thumbs.push(imageURL);
      sizes.push({ width: viewport.width, height: viewport.height });

      const wrapper = document.createElement("div");
      wrapper.className = "canvas-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;
      wrapper.style.display = i - 1 === activePage ? "block" : "none";

      const img = document.createElement("img");
      img.src = imageURL;
      img.style.width = `${viewport.width}px`; // Exact width
      img.style.height = `${viewport.height}px`; // Exact height
      img.style.display = "block";

      wrapper.appendChild(img);
      container.appendChild(wrapper);
    }

    // Dynamically set container to match active page size
    if (sizes[activePage]) {
      container.style.width = `${sizes[activePage].width}px`;
      container.style.height = `${sizes[activePage].height}px`;
      container.style.overflow = "hidden"; // prevent X-scroll
    }

    setPageSizes(sizes);
    setThumbnails(thumbs);
  };

  useEffect(() => {
    if (drawMode && sigCanvasRef.current) {
      const url = sigCanvasRef.current.getCanvas().toDataURL("image/png");
      setDrawnDataURL(url);
    }
  }, [drawMode]);

  useEffect(() => {
    renderPDFAsImage();
  }, [fileUrl, activePage]);

  return (
    <>
      <Navbar />
      <div className="p-5 mt-10 flex h-screen overflow-auto">
        <div className="w-[8vw] flex flex-col items-center gap-1 border-r overflow-y-auto">
          {thumbnails.map((thumb, idx) => (
            <img
              key={idx}
              src={thumb}
              alt={`Page ${idx + 1}`}
              className={`w-16 h-auto cursor-pointer border ${
                idx === activePage ? "border-blue-500" : "border-transparent"
              }`}
              onClick={() => setActivePage(idx)}
            />
          ))}
        </div>
        <div className="w-[70vw] flex justify-center">
          <div
            ref={containerRef}
            onClick={() => setEditingId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative bg-gray-100 border"
            style={{
              width: `${pageSizes[activePage]?.width || 800}px`,
              height: `${pageSizes[activePage]?.height || 1000}px`,
              overflow: "hidden",
            }}
          >
            {coords
              .filter((c) => c.page === activePage)
              .map((c) => (
                <div
                  key={c.id}
                  onMouseDown={(e) => startDrag(e, c.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                  }}
                  className="absolute signature"
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    width: `${c.width * 100}%`,
                    cursor: "move",
                    overflow: "visible",
                  }}
                >
                  <img
                    src={c.imageBase64}
                    style={{
                      width: "100%",
                      height: "auto",
                      opacity: c.opacity,
                      display: "block",
                    }}
                    alt="signature"
                  />
                  {editingId === c.id && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSignature(c.id);
                      }}
                      style={{
                        position: "absolute",
                        top: "-0.5em",
                        right: "-0.5em",
                        cursor: "pointer",
                      }}
                    >
                      ❌
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="w-[28vw] flex flex-col gap-4 items-center overflow-hidden">
          <div className="flex gap-2">
            <button
              onClick={() => setDrawMode(false)}
              className={`px-3 py-1 rounded ${
                !drawMode ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Type
            </button>
            <button
              onClick={() => setDrawMode(true)}
              className={`px-3 py-1 rounded ${
                drawMode ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Draw
            </button>
          </div>
          {!drawMode ? (
            <>
              <input
                type="text"
                placeholder="Type your signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="border p-2 w-60"
              />
              <div className="grid grid-cols-2 gap-2">
                {FONT_OPTIONS.map((f) => (
                  <div
                    key={f.value}
                    onClick={() => setFont(f.value)}
                    className={`cursor-pointer p-2 border rounded text-center ${
                      font === f.value ? "bg-blue-100 border-blue-500" : ""
                    }`}
                    style={{ fontFamily: f.value }}
                  >
                    <span style={{ fontFamily: f.value }}>
                      {signature || "Your Signature"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="w-60 border">
              <SignatureCanvas
                penColor={color}
                canvasProps={{ width: 240, height: 120 }}
                ref={sigCanvasRef}
                backgroundColor="rgba(0,0,0,0)"
              />
              <div className="flex justify-between items-center mt-1">
                <button
                  onClick={() => sigCanvasRef.current.clear()}
                  className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                >
                  Clear
                </button>
                <button
                  onClick={handleGenerateImage}
                  className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                >
                  Generate Image
                </button>
              </div>
            </div>
          )}
          <input
            type="number"
            min={8}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="border p-2 w-60"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 border"
          />
          <div className="flex flex-col w-60">
            <label className="text-sm text-gray-700 mb-1">Opacity</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
            <span className="text-xs text-gray-500 text-right">
              {opacity.toFixed(1)}
            </span>
          </div>
          <div
            draggable
            onDragStart={handleDragStart}
            className="cursor-move px-4 py-2 text-white rounded bg-blue-500"
            style={{
              fontFamily: font,
              fontSize,
              color,
              opacity,
              background: drawMode ? "transparent" : "#3b82f6",
            }}
          >
            {drawMode ? (
              drawnDataURL ? (
                <img
                  src={drawnDataURL}
                  alt="Drawn Signature"
                  className="h-10"
                  style={{ opacity }}
                />
              ) : (
                "Generate Image"
              )
            ) : (
              signature || "Drag Me"
            )}
          </div>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 mt-4 bg-purple-600 text-white rounded"
          >
            Download Signed PDF
          </button>
        </div>
      </div>
    </>
  );
};

export default PdfSignatureDropper;

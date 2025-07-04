import React, { useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Loader2 } from "lucide-react";
import { AppContext } from "../context/AppContext";

const PdfUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isLoggedin, backendUrl } = useContext(AppContext);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!isLoggedin) {
      navigate("/login");
      return;
    }

    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("pdf", selectedFile);

    try {
      setLoading(true);
      const res = await axios.post(backendUrl + "/api/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const filePath = res.data.filePath;
      navigate("/sign", {
        state: { fileUrl: backendUrl + `${filePath}` },
      });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-[90%] max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-700">
          Upload your PDF
        </h2>

        <label className="w-full cursor-pointer flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blue-400 rounded-xl p-6 hover:bg-blue-50 transition">
          <UploadCloud className="w-10 h-10 text-blue-500" />
          <p className="text-sm text-gray-600">
            {selectedFile ? selectedFile.name : "Click to select a PDF file"}
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={loading || !selectedFile}
          className={`mt-6 w-full flex justify-center items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition ${
            loading || !selectedFile
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5" />
              Upload PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PdfUpload;

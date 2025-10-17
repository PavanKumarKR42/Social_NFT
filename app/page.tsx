"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StoredImage {
  id: string;
  image: string;
  description: string;
  timestamp: number;
}

export default function Home() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to store images");
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadImageToPinata = async (file: File): Promise<string> => {
    try {
      setUploadingImage(true);

      if (!process.env.NEXT_PUBLIC_PINATA_JWT) {
        throw new Error(
          "Pinata JWT not configured. Add NEXT_PUBLIC_PINATA_JWT to .env.local"
        );
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Pinata upload failed (${response.status}): ${
            errorData?.error?.details || "Unknown error"
          }`
        );
      }

      const data = await response.json();

      if (!data.IpfsHash) {
        throw new Error("No IPFS hash returned from Pinata");
      }

      const ipfsHash = data.IpfsHash;
      return `ipfs://${ipfsHash}`;
    } catch (error: any) {
      const errorMsg = error?.message || "Image upload failed";
      console.error("Image upload error:", errorMsg);
      throw new Error(errorMsg);
    } finally {
      setUploadingImage(false);
    }
  };

  const storeImage = async () => {
    if (!imageFile || !description.trim()) {
      setStatus("Please select an image and add a description");
      return;
    }

    setLoading(true);
    setStatus("Uploading image to IPFS...");

    try {
      const imageIpfsUrl = await uploadImageToPinata(imageFile);
      setStatus("Storing image permanently...");

      const newImage: StoredImage = {
        id: `${Date.now()}`,
        image: imageIpfsUrl,
        description,
        timestamp: Date.now(),
      };

      const existingImages = sessionStorage.getItem("stored_images");
      const images = existingImages ? JSON.parse(existingImages) : [];
      const updatedImages = [newImage, ...images];
      sessionStorage.setItem("stored_images", JSON.stringify(updatedImages));

      setStatus(`✓ Image stored permanently on IPFS!`);
      setImageFile(null);
      setDescription("");

      setTimeout(() => {
        router.push("/feed");
      }, 2000);
    } catch (error: any) {
      console.error("Storage error:", error);
      const errorMsg = error?.message || "Unknown error";
      setStatus(`Storage failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated Background Elements */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
        pointerEvents: "none"
      }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 300 + 50 + "px",
              height: Math.random() * 300 + 50 + "px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${
                i % 3 === 0 ? "#00f2fe" : i % 3 === 1 ? "#4facfe" : "#00c9ff"
              } 0%, transparent 70%)`,
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              animation: `float ${Math.random() * 10 + 10}s infinite ease-in-out`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Grid Pattern Overlay */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `linear-gradient(rgba(79, 172, 254, 0.1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(79, 172, 254, 0.1) 1px, transparent 1px)`,
        backgroundSize: "50px 50px",
        opacity: 0.3,
        pointerEvents: "none"
      }} />

      <div style={{ 
        position: "relative", 
        zIndex: 1,
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px"
      }}>
        {/* Hero Section */}
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
            padding: "8px 20px",
            background: "rgba(79, 172, 254, 0.1)",
            border: "1px solid rgba(79, 172, 254, 0.3)",
            borderRadius: "50px",
            backdropFilter: "blur(10px)"
          }}>
            <span style={{ fontSize: "20px" }}>⛓️</span>
            <span style={{ 
              color: "#4facfe",
              fontWeight: "600",
              fontSize: "14px",
              letterSpacing: "1px"
            }}>DECENTRALIZED STORAGE</span>
          </div>

          <h1 style={{
            fontSize: "4rem",
            fontWeight: "900",
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "20px",
            textShadow: "0 0 80px rgba(79, 172, 254, 0.3)",
            letterSpacing: "-2px"
          }}>
            OnchainStorage
          </h1>

          <p style={{
            fontSize: "1.3rem",
            color: "rgba(255, 255, 255, 0.8)",
            maxWidth: "700px",
            margin: "0 auto 40px",
            lineHeight: "1.6"
          }}>
            Store your images permanently on IPFS • Immutable • Decentralized • Forever
          </p>

          {/* Stats Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginTop: "40px",
            maxWidth: "900px",
            margin: "0 auto"
          }}>
            {[
              { icon: "🔗", value: "100%", label: "Decentralized", color: "#4facfe" },
              { icon: "♾️", value: "Forever", label: "Permanent Storage", color: "#00f2fe" },
              { icon: "🌐", value: "IPFS", label: "Pinata Powered", color: "#4facfe" }
            ].map((stat, i) => (
              <div key={i} style={{
                background: "rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "20px",
                padding: "30px 20px",
                transition: "all 0.3s ease",
                cursor: "pointer",
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.1), inset 0 0 0 1px ${stat.color}20`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow = `0 12px 48px rgba(79, 172, 254, 0.3), inset 0 0 0 1px ${stat.color}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.1), inset 0 0 0 1px ${stat.color}20`;
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>{stat.icon}</div>
                <div style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: stat.color,
                  marginBottom: "8px"
                }}>{stat.value}</div>
                <div style={{
                  fontSize: "0.9rem",
                  color: "rgba(255, 255, 255, 0.7)"
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Upload Card */}
        <div style={{
          maxWidth: "700px",
          margin: "0 auto",
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "30px",
          padding: "40px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 style={{
              fontSize: "2rem",
              fontWeight: "700",
              color: "#fff",
              marginBottom: "10px"
            }}>Store Your Image</h2>
            <p style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "1rem"
            }}>
              Upload and store your images permanently on blockchain
            </p>
          </div>

          {/* Status Message */}
          <div style={{
            padding: "16px 20px",
            background: status.includes("✓") 
              ? "rgba(0, 255, 127, 0.1)" 
              : status.includes("failed")
              ? "rgba(255, 69, 96, 0.1)"
              : "rgba(79, 172, 254, 0.1)",
            border: `1px solid ${
              status.includes("✓") 
                ? "rgba(0, 255, 127, 0.3)" 
                : status.includes("failed")
                ? "rgba(255, 69, 96, 0.3)"
                : "rgba(79, 172, 254, 0.3)"
            }`,
            borderRadius: "15px",
            marginBottom: "30px",
            color: "#fff",
            textAlign: "center",
            fontWeight: "500"
          }}>
            {status}
          </div>

          {/* Image Upload */}
          <div style={{ marginBottom: "25px" }}>
            <label style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.9)",
              fontWeight: "600",
              marginBottom: "12px",
              fontSize: "1rem"
            }}>
              📸 Select Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              disabled={loading || uploadingImage}
              style={{
                width: "100%",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "2px dashed rgba(79, 172, 254, 0.3)",
                borderRadius: "15px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "1rem",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.6)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.3)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              }}
            />
            {imageFile && (
              <p style={{
                fontSize: "0.9rem",
                color: "rgba(255, 255, 255, 0.6)",
                marginTop: "10px"
              }}>
                ✓ Selected: {imageFile.name}
              </p>
            )}
          </div>

          {/* Preview */}
          {imageFile && (
            <div style={{ marginBottom: "30px" }}>
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                style={{
                  width: "100%",
                  maxHeight: "350px",
                  objectFit: "cover",
                  borderRadius: "20px",
                  border: "2px solid rgba(79, 172, 254, 0.3)",
                  boxShadow: "0 10px 40px rgba(79, 172, 254, 0.2)"
                }}
              />
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: "30px" }}>
            <label style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.9)",
              fontWeight: "600",
              marginBottom: "12px",
              fontSize: "1rem"
            }}>
              📝 Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for your image..."
              disabled={loading || uploadingImage}
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "15px",
                color: "#fff",
                fontSize: "1rem",
                resize: "vertical",
                fontFamily: "inherit"
              }}
            />
          </div>

          {/* Store Button */}
          <button
            onClick={storeImage}
            disabled={loading || uploadingImage || !imageFile}
            style={{
              width: "100%",
              padding: "18px",
              background: loading || uploadingImage || !imageFile
                ? "rgba(100, 100, 100, 0.3)"
                : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              border: "none",
              borderRadius: "15px",
              color: "#fff",
              fontSize: "1.1rem",
              fontWeight: "700",
              cursor: loading || uploadingImage || !imageFile ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: loading || uploadingImage || !imageFile
                ? "none"
                : "0 10px 30px rgba(79, 172, 254, 0.4)",
              marginBottom: "20px"
            }}
            onMouseEnter={(e) => {
              if (!loading && !uploadingImage && imageFile) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 15px 40px rgba(79, 172, 254, 0.6)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(79, 172, 254, 0.4)";
            }}
          >
            {loading ? "⏳ Storing..." : uploadingImage ? "📤 Uploading..." : "🚀 Store Image Permanently"}
          </button>

          {/* Info Section */}
          <div style={{
            padding: "20px",
            background: "rgba(79, 172, 254, 0.08)",
            border: "1px solid rgba(79, 172, 254, 0.2)",
            borderRadius: "15px",
            fontSize: "0.9rem",
            lineHeight: "1.8",
            color: "rgba(255, 255, 255, 0.8)"
          }}>
            <p style={{ marginBottom: "12px", fontWeight: "700", color: "#4facfe" }}>
              ⚡ What happens when you store:
            </p>
            <ul style={{ marginLeft: "20px", listStyle: "none", padding: 0 }}>
              {[
                "Image uploaded to IPFS via Pinata",
                "Receives permanent IPFS hash (CID)",
                "Stored forever on decentralized network",
                "Accessible from anywhere in the world",
                "Ready to mint as NFT"
              ].map((item, i) => (
                <li key={i} style={{ marginBottom: "8px" }}>
                  <span style={{ color: "#00f2fe", marginRight: "8px" }}>▹</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* View Feed Button */}
          <button
            onClick={() => router.push("/feed")}
            style={{
              width: "100%",
              padding: "16px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "15px",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
              marginTop: "20px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }}
          >
            📺 View All Stored Images
          </button>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: "60px",
          color: "rgba(255, 255, 255, 0.6)"
        }}>
          <p style={{ marginBottom: "20px", fontSize: "0.95rem" }}>
            Powered by Pinata IPFS • Base Mainnet • Decentralized Forever
          </p>
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px"
          }}>
            {[
              { href: "https://x.com/pavankumardotkr", img: "/images/x.png", alt: "X" },
              { href: "https://farcaster.xyz/pavankumarkr", img: "/images/farcaster.png", alt: "Farcaster" }
            ].map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  transition: "all 0.3s ease",
                  textDecoration: "none"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(79, 172, 254, 0.2)";
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 10px 25px rgba(79, 172, 254, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <img src={link.img} alt={link.alt} style={{ width: "24px", height: "24px" }} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        input::placeholder, textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        input:focus, textarea:focus {
          outline: none;
          border-color: rgba(79, 172, 254, 0.6) !important;
          box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
        }
      `}</style>
    </div>
  );
}
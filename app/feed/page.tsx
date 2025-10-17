"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createBaseAccountSDK } from "@base-org/account";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData } from "viem";

interface StoredImage {
  id: string;
  image: string;
  description: string;
  timestamp: number;
}

const NFT_CONTRACT_ADDRESS = "0x54396910e3a670a9C4F75d5314192EA897491C3c";

const NFT_CONTRACT_ABI = [
  {
    inputs: [{ internalType: "string", name: "tokenURI", type: "string" }],
    name: "mintNFT",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function FeedPage() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [provider, setProvider] = useState<ReturnType<
    ReturnType<typeof createBaseAccountSDK>["getProvider"]
  > | null>(null);
  const [connected, setConnected] = useState(false);
  const [subAccountAddress, setSubAccountAddress] = useState<string>("");
  const [universalAddress, setUniversalAddress] = useState<string>("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [mintingImageId, setMintingImageId] = useState<string | null>(null);
  const [mintStatus, setMintStatus] = useState<{ [key: string]: string }>({});

  // Initialize SDK
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        const sdkInstance = createBaseAccountSDK({
          appName: "OnchainStorage",
          appLogoUrl: "https://base.org/logo.png",
          appChainIds: [baseSepolia.id],
          subAccounts: {
            creation: "on-connect",
            defaultAccount: "sub",
          },
        });

        const providerInstance = sdkInstance.getProvider();
        setProvider(providerInstance);
      } catch (error) {
        console.error("SDK initialization failed:", error);
      }
    };

    initializeSDK();
  }, []);

  // Load stored images
  useEffect(() => {
    const loadImages = () => {
      try {
        const storedImages = sessionStorage.getItem("stored_images");
        if (storedImages) {
          const parsedImages = JSON.parse(storedImages);
          const sortedImages = parsedImages.sort(
            (a: StoredImage, b: StoredImage) => b.timestamp - a.timestamp
          );
          setImages(sortedImages);
        }
      } catch (error) {
        console.error("Failed to load images:", error);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, []);

  const connectWallet = async () => {
    if (!provider) return;

    setConnectLoading(true);

    try {
      // Step 1: Connect wallet
      await provider.request({
        method: "wallet_connect",
        params: [],
      });

      // Step 2: Request accounts
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

      console.log("Connected accounts:", accounts);

      // With defaultAccount: 'sub', accounts[0] is sub, accounts[1] is universal
      const subAddr = accounts[0];
      const universalAddr = accounts[1] || accounts[0];
      
      setSubAccountAddress(subAddr);
      setUniversalAddress(universalAddr);
      
      // Step 3: Wait a moment for sub-account to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setConnected(true);
      console.log("Sub-account:", subAddr);
      console.log("Universal account:", universalAddr);
    } catch (error: any) {
      console.error("Connection failed:", error);
      alert("Failed to connect wallet. Please try again.");
    } finally {
      setConnectLoading(false);
    }
  };

  const mintNFT = useCallback(async (image: StoredImage) => {
    if (!provider || !subAccountAddress) {
      setMintStatus(prev => ({ ...prev, [image.id]: "Please connect wallet first" }));
      return;
    }

    setMintingImageId(image.id);
    setMintStatus(prev => ({ ...prev, [image.id]: "Preparing transaction..." }));

    try {
      // Verify the account is ready
      const accounts = (await provider.request({
        method: "eth_accounts",
        params: [],
      })) as string[];

      console.log("Current accounts for minting:", accounts);

      if (!accounts || accounts.length === 0 || accounts[0] !== subAccountAddress) {
        throw new Error("Sub-account not properly initialized. Please reconnect.");
      }

      // Encode the mint function call
      const mintData = encodeFunctionData({
        abi: NFT_CONTRACT_ABI,
        functionName: "mintNFT",
        args: [image.image],
      });

      setMintStatus(prev => ({ ...prev, [image.id]: "Confirm in wallet..." }));

      // Send transaction using wallet_sendCalls
      const callsId = (await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: subAccountAddress,
            calls: [
              {
                to: NFT_CONTRACT_ADDRESS,
                data: mintData,
                value: "0x0",
              },
            ],
          },
        ],
      })) as string;

      console.log("Transaction sent! Calls ID:", callsId);
      setMintStatus(prev => ({ 
        ...prev, 
        [image.id]: `✓ NFT Minted Successfully! 🎉` 
      }));

      setTimeout(() => {
        setMintStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[image.id];
          return newStatus;
        });
      }, 8000);

    } catch (error: any) {
      console.error("Mint failed:", error);
      
      let errorMsg = "Mint failed";
      
      if (error?.message) {
        if (error.message.includes("no matching signer")) {
          errorMsg = "Sub-account not ready. Please reconnect wallet.";
        } else if (error.message.includes("insufficient")) {
          errorMsg = "Insufficient funds for gas";
        } else if (error.message.includes("rejected") || error.message.includes("denied")) {
          errorMsg = "Transaction rejected";
        } else {
          errorMsg = error.message.slice(0, 50);
        }
      }
      
      setMintStatus(prev => ({ 
        ...prev, 
        [image.id]: `❌ ${errorMsg}` 
      }));
      
      setTimeout(() => {
        setMintStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[image.id];
          return newStatus;
        });
      }, 8000);
    } finally {
      setMintingImageId(null);
    }
  }, [provider, subAccountAddress]);

  const filteredImages = images.filter((image) =>
    searchTerm === ""
      ? true
      : image.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getImageUrl = (ipfsUrl: string) => {
    if (ipfsUrl.startsWith("ipfs://")) {
      return `https://gateway.pinata.cloud/ipfs/${ipfsUrl.replace("ipfs://", "")}`;
    }
    return ipfsUrl;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Recently";
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated Background */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
        pointerEvents: "none"
      }}>
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 250 + 50 + "px",
              height: Math.random() * 250 + 50 + "px",
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

      {/* Grid Pattern */}
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
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "40px 20px"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          <div>
            <h1 style={{
              fontSize: "3rem",
              fontWeight: "900",
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "10px",
              letterSpacing: "-1px"
            }}>
              Image Gallery
            </h1>
            <p style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "1.1rem"
            }}>
              All images stored permanently on IPFS • Free mint (only gas) • Base Sepolia Testnet
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link href="/">
              <button style={{
                padding: "14px 28px",
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                border: "none",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow: "0 10px 30px rgba(79, 172, 254, 0.4)",
                whiteSpace: "nowrap"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 15px 40px rgba(79, 172, 254, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 10px 30px rgba(79, 172, 254, 0.4)";
              }}>
                ➕ Create Post
              </button>
            </Link>

            {!connected ? (
              <button
                onClick={connectWallet}
                disabled={connectLoading || !provider}
                style={{
                  padding: "14px 28px",
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: connectLoading || !provider ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => {
                  if (!connectLoading && provider) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
              >
                {connectLoading ? "⏳ Connecting..." : "🔗 Connect Base Sepolia"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                <button
                  onClick={() => {
                    setConnected(false);
                    setSubAccountAddress("");
                    setUniversalAddress("");
                  }}
                  style={{
                    padding: "14px 28px",
                    background: "rgba(0, 255, 127, 0.1)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    whiteSpace: "nowrap"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 69, 96, 0.2)";
                    e.currentTarget.style.borderColor = "rgba(255, 69, 96, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0, 255, 127, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(0, 255, 127, 0.3)";
                  }}
                >
                  ✓ Connected
                </button>
                <div style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "0.75rem",
                  color: "rgba(255, 255, 255, 0.8)",
                  fontFamily: "monospace"
                }}>
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "rgba(79, 172, 254, 0.8)", fontWeight: "600" }}>Sub:</span> {subAccountAddress.slice(0, 6)}...{subAccountAddress.slice(-4)}
                  </div>
                  <div>
                    <span style={{ color: "rgba(0, 255, 127, 0.8)", fontWeight: "600" }}>Universal:</span> {universalAddress.slice(0, 6)}...{universalAddress.slice(-4)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {images.length > 0 && (
          <div style={{
            maxWidth: "600px",
            margin: "0 auto 40px",
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            padding: "30px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)"
          }}>
            <label style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.9)",
              fontWeight: "600",
              marginBottom: "12px",
              fontSize: "1rem"
            }}>
              🔍 Search Images
            </label>
            <input
              type="text"
              placeholder="Search by description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "1rem",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.6)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79, 172, 254, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        )}

        {/* Images Count */}
        {images.length > 0 && (
          <div style={{
            textAlign: "center",
            marginBottom: "30px",
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "1rem"
          }}>
            Found {filteredImages.length} of {images.length} images
          </div>
        )}

        {/* Images Grid */}
        {loading ? (
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            padding: "60px",
            textAlign: "center",
            color: "#fff",
            fontSize: "1.2rem"
          }}>
            <div style={{ marginBottom: "20px", fontSize: "3rem" }}>⏳</div>
            Loading images...
          </div>
        ) : filteredImages.length === 0 ? (
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            padding: "60px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>
              {images.length === 0 ? "📭" : "🔍"}
            </div>
            <p style={{ color: "#fff", fontSize: "1.3rem", marginBottom: "30px" }}>
              {images.length === 0 ? "No images stored yet" : "No matching images found"}
            </p>
            <Link href="/">
              <button style={{
                padding: "16px 32px",
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                border: "none",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "1.1rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow: "0 10px 30px rgba(79, 172, 254, 0.4)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 15px 40px rgba(79, 172, 254, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 10px 30px rgba(79, 172, 254, 0.4)";
              }}>
                Store Your First Image
              </button>
            </Link>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "30px",
            marginBottom: "60px"
          }}>
            {filteredImages.map((image) => (
              <div
                key={image.id}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "20px",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 20px 60px rgba(79, 172, 254, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.2)";
                }}
              >
                {/* Image */}
                <div style={{
                  width: "100%",
                  height: "280px",
                  overflow: "hidden",
                  position: "relative"
                }}>
                  <img
                    src={getImageUrl(image.image)}
                    alt={image.description}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.5s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "100px",
                    background: "linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)"
                  }} />
                </div>

                {/* Content */}
                <div style={{ padding: "24px" }}>
                  {/* Description */}
                  <p style={{
                    color: "#fff",
                    marginBottom: "16px",
                    lineHeight: "1.6",
                    fontSize: "0.95rem",
                    minHeight: "60px"
                  }}>
                    {image.description || "No description"}
                  </p>

                  {/* Metadata */}
                  <div style={{
                    fontSize: "0.8rem",
                    color: "rgba(255, 255, 255, 0.5)",
                    paddingTop: "16px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    marginBottom: "16px"
                  }}>
                    <div style={{ marginBottom: "6px" }}>
                      📅 {formatDate(image.timestamp)}
                    </div>
                    <div style={{ wordBreak: "break-all" }}>
                      🔗 {image.image.slice(0, 30)}...
                    </div>
                  </div>

                  {/* Mint Status */}
                  {mintStatus[image.id] && (
                    <div style={{
                      padding: "12px",
                      background: mintStatus[image.id].includes("✓") 
                        ? "rgba(0, 255, 127, 0.15)" 
                        : mintStatus[image.id].includes("❌")
                        ? "rgba(255, 69, 96, 0.15)"
                        : "rgba(79, 172, 254, 0.15)",
                      border: `1px solid ${
                        mintStatus[image.id].includes("✓") 
                          ? "rgba(0, 255, 127, 0.3)" 
                          : mintStatus[image.id].includes("❌")
                          ? "rgba(255, 69, 96, 0.3)"
                          : "rgba(79, 172, 254, 0.3)"
                      }`,
                      borderRadius: "10px",
                      fontSize: "0.9rem",
                      textAlign: "center",
                      color: "#fff",
                      marginBottom: "12px",
                      fontWeight: "500"
                    }}>
                      {mintStatus[image.id]}
                    </div>
                  )}

                  {/* Mint Button - FREE! */}
                  {connected ? (
                    <button
                      onClick={() => mintNFT(image)}
                      disabled={mintingImageId === image.id}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: mintingImageId === image.id
                          ? "rgba(100, 100, 100, 0.3)"
                          : "linear-gradient(135deg, #00ff7f 0%, #00ff40 100%)",
                        border: "none",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "0.95rem",
                        fontWeight: "700",
                        cursor: mintingImageId === image.id ? "not-allowed" : "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: mintingImageId === image.id 
                          ? "none" 
                          : "0 8px 25px rgba(0, 255, 127, 0.4)"
                      }}
                      onMouseEnter={(e) => {
                        if (mintingImageId !== image.id) {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 12px 35px rgba(0, 255, 127, 0.6)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 255, 127, 0.4)";
                      }}
                    >
                      {mintingImageId === image.id ? "⏳ Minting..." : "🎨 FREE Mint NFT (Gas Only)"}
                    </button>
                  ) : (
                    <button
                      onClick={connectWallet}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                        e.currentTarget.style.borderColor = "rgba(79, 172, 254, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                      }}
                    >
                      🔗 Connect to Mint
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: "60px",
          color: "rgba(255, 255, 255, 0.6)"
        }}>
          <p style={{ marginBottom: "20px", fontSize: "0.95rem" }}>
            Powered by Pinata IPFS • Base Sepolia Testnet • Sub Accounts • FREE Mint!
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
        
        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
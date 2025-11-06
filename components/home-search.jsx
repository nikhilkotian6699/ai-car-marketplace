"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { processImageSearch } from "@/actions/home";
import useFetch from "@/hooks/use-fetch";

export const HomeSearch = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const {
    loading: isProcessing,
    fn: processImageFn,
    data: imageResult,
    error: imageError,
  } = useFetch(processImageSearch);

  const handleTextSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/cars?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    try {
      const result = await processImageFn(file);
      
      if (result?.success && result?.data) {
        const { make, bodyType, color } = result.data;
        
        // Build search URL with AI-extracted parameters
        const params = new URLSearchParams();
        if (make) params.append("make", make);
        if (bodyType) params.append("bodyType", bodyType);
        if (color) params.append("search", color);
        
        toast.success("Image processed successfully! Redirecting to results...");
        router.push(`/cars?${params.toString()}`);
      } else {
        toast.error("Could not process the image. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to process image. Please try again.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  return (
    <div className="space-y-6">
      {/* Text Search */}
      <form onSubmit={handleTextSearch} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="top-1/2 left-4 absolute w-5 h-5 text-gray-400 -translate-y-1/2 transform" />
          <Input
            type="text"
            placeholder="Search by make, model, or color..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/90 backdrop-blur-sm pl-12 border-white/30 focus:border-yellow-400 h-14 text-lg"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="bg-gradient-to-r from-yellow-400 hover:from-yellow-500 to-yellow-500 hover:to-yellow-600 px-8 h-14 font-semibold text-black"
        >
          Search
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-white/30 h-px"></div>
        <span className="font-medium text-white/80">OR</span>
        <div className="flex-1 bg-white/30 h-px"></div>
      </div>

      {/* Image Upload */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          dragActive
            ? "border-yellow-400 bg-yellow-400/10"
            : "border-white/30 bg-white/5"
        } ${isProcessing ? "opacity-50 pointer-events-none" : "hover:border-yellow-400 hover:bg-yellow-400/5"}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-4">
          <div className="flex justify-center items-center bg-gradient-to-br from-yellow-400 to-yellow-500 mx-auto rounded-full w-16 h-16">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-black animate-spin" />
            ) : (
              <Camera className="w-8 h-8 text-black" />
            )}
          </div>
          
          <div>
            <h3 className="mb-2 font-semibold text-white text-xl">
              {isProcessing ? "Processing Image..." : "AI-Powered Image Search"}
            </h3>
            <p className="mb-4 text-white/80">
              Upload a car image and let our AI find similar vehicles
            </p>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
              onClick={() => document.getElementById("image-upload").click()}
              disabled={isProcessing}
            >
              <Upload className="mr-2 w-5 h-5" />
              Choose Image
            </Button>
            
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            
            <p className="text-white/60 text-sm">
              Drag & drop an image here, or click to browse
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
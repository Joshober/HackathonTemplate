import { useState } from "react";
import { Upload, Sparkles, Instagram, Twitter, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";

export function MemoryBuilder() {
  const [caption, setCaption] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([
    "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400",
    "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=400",
  ]);

  const generateCaption = () => {
    const aiCaption =
      "🌉 San Francisco business trip was a huge success! Met with amazing clients, explored innovation hubs, and strengthened partnerships. The Bay Area never disappoints! #BusinessTravel #SanFrancisco #Lockton";
    setCaption(aiCaption);
    toast.success("AI caption generated!");
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-orange-600" />
          Memory Builder
        </h1>
        <p className="text-gray-600">Create and share your trip story</p>
      </div>

      {/* Photo Upload */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          Trip Photos ({selectedPhotos.length})
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {selectedPhotos.map((photo, index) => (
            <div
              key={index}
              className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200"
            >
              <img src={photo} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          <button className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <Upload className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-500 mt-1">Upload</span>
          </button>
        </div>
      </div>

      {/* Caption Generator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">Caption</div>
          <button
            onClick={generateCaption}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg text-sm font-medium flex items-center gap-1 hover:shadow-lg transition-all"
          >
            <Wand2 className="w-4 h-4" />
            AI Generate
          </button>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption or let AI generate one..."
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          rows={5}
        />
      </div>

      {/* Post Preview */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-gray-700 mb-3">Preview</div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold">
                JD
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">John Doe</h3>
                <p className="text-xs text-gray-500">Just now</p>
              </div>
            </div>
          </div>
          {selectedPhotos.length > 0 && (
            <img
              src={selectedPhotos[0]}
              alt="Preview"
              className="w-full h-64 object-cover"
            />
          )}
          <div className="p-4">
            <p className="text-gray-700 text-sm">
              {caption || "Your caption will appear here..."}
            </p>
          </div>
        </div>
      </div>

      {/* Share Options */}
      <div className="space-y-3">
        <button className="w-full bg-gradient-to-r from-orange-600 to-pink-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all shadow-orange-500/30">
          <Instagram className="w-5 h-5" />
          Share to Instagram
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button className="py-3 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
            <Twitter className="w-4 h-4" />
            Twitter
          </button>
          <button className="py-3 bg-gray-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* AI Features */}
      <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl border border-orange-200">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-orange-600" />
          <div className="text-sm font-semibold text-orange-900">AI Features</div>
        </div>
        <div className="space-y-1 text-sm text-orange-700">
          <div>• Auto-select best photos</div>
          <div>• Generate engaging captions</div>
          <div>• Optimize for social media</div>
        </div>
      </div>
    </div>
  );
}

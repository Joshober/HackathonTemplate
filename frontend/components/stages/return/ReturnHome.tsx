import { useRouter } from "next/navigation";
import { Camera, Edit3, Share2, ArrowRight } from "lucide-react";

const teamPosts = [
  {
    id: 1,
    member: "Sarah Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    caption: "Amazing client meeting at the Golden Gate! 🌉",
    mediaCount: 3,
    preview: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400",
  },
  {
    id: 2,
    member: "Mike Johnson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
    caption: "InsurTech summit was incredible. Great connections made! 💼",
    mediaCount: 5,
    preview: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400",
  },
];

export function ReturnHome() {
  const router = useRouter();
  const navigate = router.push;

  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Post-Trip Sharing
        </h1>
        <p className="text-gray-600">Share your trip experiences with the team</p>
      </div>

      {/* Create Your Post */}
      <button
        onClick={() => navigate("/memory")}
        className="w-full bg-gradient-to-br from-orange-500 to-pink-500 text-white rounded-2xl p-6 mb-6 shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Camera className="w-8 h-8" />
            <div className="text-left">
              <h3 className="font-bold text-lg">Create Your Post</h3>
              <p className="text-orange-100 text-sm">Share photos & memories</p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6" />
        </div>
        <div className="bg-white/20 rounded-lg p-3 text-left">
          <p className="text-sm text-white">
            AI will help you create engaging captions and select the best photos
          </p>
        </div>
      </button>

      {/* Team Posts */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold text-gray-900">Team Posts</h2>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {teamPosts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <img
              src={post.preview}
              alt="Post preview"
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={post.avatar}
                  alt={post.member}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h3 className="font-semibold text-gray-900">{post.member}</h3>
                  <p className="text-xs text-gray-500">{post.mediaCount} photos</p>
                </div>
              </div>
              <p className="text-gray-700">{post.caption}</p>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                  View All
                </button>
                <button className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
                  Like
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-3xl font-bold text-orange-600">12</div>
          <div className="text-sm text-gray-600 mt-1">Total Posts</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">48</div>
          <div className="text-sm text-gray-600 mt-1">Photos Shared</div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Search, SlidersHorizontal, Heart, ArrowRight, Star, MapPin, X, ChevronLeft, ChevronRight } from "lucide-react";
import { travelOpportunities } from "../../../data/mockData";
import { toast } from "sonner";
import { PageHeader } from "../../common/PageHeader";

export function Explorer() {
  const [selectedCategory, setSelectedCategory] = useState("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [selectedOpportunity, setSelectedOpportunity] = useState<typeof travelOpportunities[0] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const categories = ["All Types", "Landmarks", "Activities", "Team Events"];

  const toggleAddToPlan = (opportunityId: string, opportunityName: string) => {
    setAddedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(opportunityId)) {
        newSet.delete(opportunityId);
        toast.success(`${opportunityName} removed from your plan`);
      } else {
        newSet.add(opportunityId);
        toast.success(`${opportunityName} added to your plan!`);
      }
      return newSet;
    });
  };

  const showDetails = (opportunity: typeof travelOpportunities[0]) => {
    setSelectedOpportunity(opportunity);
    setCurrentImageIndex(0);
  };

  const closeDetails = () => {
    setSelectedOpportunity(null);
    setCurrentImageIndex(0);
  };

  // Generate multiple images for gallery (using the same image for demo)
  const getImageGallery = (baseImage: string) => {
    return [baseImage, baseImage, baseImage, baseImage];
  };

  const nextImage = () => {
    if (selectedOpportunity) {
      const gallery = getImageGallery(selectedOpportunity.image);
      setCurrentImageIndex((prev) => (prev + 1) % gallery.length);
    }
  };

  const prevImage = () => {
    if (selectedOpportunity) {
      const gallery = getImageGallery(selectedOpportunity.image);
      setCurrentImageIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
    }
  };

  // Filter opportunities
  const filteredOpportunities = travelOpportunities.filter((opp) => {
    const categoryMatch =
      selectedCategory === "All Types" ||
      (selectedCategory === "Landmarks" && opp.type === "landmark") ||
      (selectedCategory === "Activities" && opp.type === "activity") ||
      (selectedCategory === "Team Events" && opp.category === "Team Activity");

    const searchMatch = 
      searchQuery === "" ||
      opp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.location.toLowerCase().includes(searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-gray-50">
      {/* Header Section */}
      <PageHeader subtitle="Discover amazing destinations" />
      
      <div className="px-6 pt-2 pb-4">
        {/* Search and Filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search destinations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
          </div>
          <button className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-all shadow-lg">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Section Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Browse opportunities
        </h2>

        {/* Category Pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? "bg-gray-900 text-white shadow-lg"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="px-6 pb-4">
        <p className="text-sm text-gray-500">
          {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'} found
        </p>
      </div>

      {/* Opportunity Cards */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="space-y-6">
          {filteredOpportunities.map((opportunity) => (
            <div
              key={opportunity.id}
              className="relative rounded-[28px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 group"
              style={{ aspectRatio: '1/1.2' }}
            >
              {/* Image */}
              <img
                src={opportunity.image}
                alt={opportunity.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Heart Icon */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAddToPlan(opportunity.id, opportunity.name);
                }}
                className={`absolute top-6 right-6 w-11 h-11 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-all ${
                  addedItems.has(opportunity.id) ? 'bg-red-500/90' : 'bg-white/20'
                }`}
              >
                <Heart className={`w-5 h-5 ${addedItems.has(opportunity.id) ? 'text-white fill-white' : 'text-white'}`} />
              </button>

              {/* Type Badge */}
              <div className="absolute top-6 left-6">
                <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-white">
                  {opportunity.type === "landmark" ? "Landmark" : "Activity"}
                </span>
              </div>

              {/* Content at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                {/* Location Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full mb-3">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs font-semibold text-white">
                    {opportunity.location}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {opportunity.name}
                </h3>

                {/* Rating and Reviews */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5">
                    <Star className="w-4 h-4 text-white fill-white" />
                    <span className="text-sm font-bold text-white">5.0</span>
                  </div>
                  <span className="text-sm text-white/80 font-medium">
                    {opportunity.participants * 10} reviews
                  </span>
                </div>

                {/* See More Button */}
                <button 
                  onClick={() => showDetails(opportunity)}
                  className="w-full bg-white/90 backdrop-blur-md hover:bg-white text-gray-900 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <span>See more</span>
                  <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            </div>
          ))}

          {filteredOpportunities.length === 0 && (
            <div className="text-center py-16">
              <p className="text-lg font-bold text-gray-900 mb-1">No opportunities found</p>
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Opportunity Details Modal */}
      {selectedOpportunity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-11/12 max-w-4xl p-6 relative">
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
              onClick={closeDetails}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Image Gallery */}
            <div className="relative">
              <img
                src={getImageGallery(selectedOpportunity.image)[currentImageIndex]}
                alt={selectedOpportunity.name}
                className="w-full h-96 object-cover rounded-2xl"
              />
              <button
                className="absolute top-1/2 left-4 -translate-y-1/2 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                onClick={prevImage}
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                className="absolute top-1/2 right-4 -translate-y-1/2 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                onClick={nextImage}
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Details */}
            <div className="mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedOpportunity.name}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {selectedOpportunity.location}
              </p>
              <p className="text-gray-700 mb-4">
                {selectedOpportunity.description}
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5 bg-gray-200 rounded-full px-3 py-1.5">
                  <Star className="w-4 h-4 text-gray-900 fill-gray-900" />
                  <span className="text-sm font-bold text-gray-900">5.0</span>
                </div>
                <span className="text-sm text-gray-500 font-medium">
                  {selectedOpportunity.participants * 10} reviews
                </span>
              </div>
              <button
                className="w-full bg-gray-900 text-white py-3.5 rounded-full font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                onClick={() => toggleAddToPlan(selectedOpportunity.id, selectedOpportunity.name)}
              >
                <span>{addedItems.has(selectedOpportunity.id) ? 'Remove from Plan' : 'Add to Plan'}</span>
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
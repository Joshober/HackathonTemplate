import { useRouter } from "next/navigation";
import { ArrowRight, Star, MapPin, X, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { getTravelPayload, isTravelItem } from "@/lib/travelItem";
import { useEffect } from "react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "../../common/PageHeader";

export function PlanHome() {
  const router = useRouter();
  const navigate = router.push;
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    api.getItems().then((items) => {
      const travelItems = items.filter(isTravelItem).map(item => {
        const t = getTravelPayload(item);
        return {
          originalItem: item,
          id: item._id,
          name: item.title,
          image: t?.imageUrl || item.imageUrls?.[0] || "/imports/image-2.png",
          location: t?.location || "Unknown Location",
          description: item.description || "No description available.",
          cost: t?.bookingEstimate ? `$${t.bookingEstimate.flightLow}-$${t.bookingEstimate.flightHigh}` : "$500-$800",
          duration: t?.bookingEstimate?.nights ? `${t.bookingEstimate.nights} nights` : "3 nights",
          status: "ready"
        };
      });
      setCards(travelItems);
    });
  }, []);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [acceptedCards, setAcceptedCards] = useState<any[]>([]);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard = cards[currentCardIndex];

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const swipeThreshold = 100;

    if (dragOffset.x > swipeThreshold) {
      // Swipe right - Accept
      handleAccept();
    } else if (dragOffset.x < -swipeThreshold) {
      // Swipe left - Reject
      handleReject();
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const handleAccept = () => {
    if (!currentCard) return;
    setAcceptedCards([...acceptedCards, currentCard]);
    toast.success(`${currentCard.name} added to your plan! ❤️`);
    moveToNextCard();
  };

  const handleReject = () => {
    if (!currentCard) return;
    toast.success(`${currentCard.name} removed ✕`);
    moveToNextCard();
  };

  const moveToNextCard = () => {
    setDragOffset({ x: 0, y: 0 });
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      // All cards reviewed
      if (acceptedCards.length > 0) {
        toast.success("All opportunities reviewed!");
      }
    }
  };

  const handleSubmitPlan = () => {
    if (acceptedCards.length === 0) {
      toast.error("Please accept at least one opportunity");
      return;
    }
    toast.success(`${acceptedCards.length} opportunities submitted for approval!`);
    navigate("/approval");
  };

  const rotation = dragOffset.x / 20;
  const opacity = 1 - Math.abs(dragOffset.x) / 200;

  if (!currentCard && acceptedCards.length === 0) {
    return (
      <div className="max-w-md mx-auto h-full flex flex-col items-center justify-center bg-white px-6">
        <p className="text-gray-500 text-center">No opportunities available</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-gray-50">
      {/* Header Section */}
      <PageHeader subtitle="Swipe right to add, swipe left to skip" />

      {/* Card Stack Area */}
      <div className="flex-1 relative px-6 py-8 flex items-center justify-center">
        {currentCard ? (
          <div
            ref={cardRef}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            className="relative w-full max-w-sm cursor-grab active:cursor-grabbing touch-none"
            style={{
              transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
              opacity: opacity,
              transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
            }}
          >
            <div
              className="relative rounded-[32px] overflow-hidden shadow-2xl"
              style={{ aspectRatio: '0.75' }}
            >
              {/* Image */}
              <img
                src={currentCard.image}
                alt={currentCard.name}
                className="w-full h-full object-cover"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Swipe Indicators */}
              {dragOffset.x > 50 && (
                <div className="absolute top-8 right-8 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-lg shadow-2xl transform rotate-12">
                  ❤️ ACCEPT
                </div>
              )}
              {dragOffset.x < -50 && (
                <div className="absolute top-8 left-8 bg-red-500 text-white px-6 py-3 rounded-full font-bold text-lg shadow-2xl transform -rotate-12">
                  ✕ SKIP
                </div>
              )}

              {/* Location Badge */}
              <div className="absolute top-6 left-6">
                <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full">
                  <MapPin className="w-4 h-4 text-white" />
                  <span className="text-sm font-semibold text-white">
                    {currentCard.location}
                  </span>
                </div>
              </div>

              {/* Content at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-3xl font-bold text-white mb-3">
                  {currentCard.name}
                </h3>

                <p className="text-white/90 text-sm mb-4 line-clamp-2">
                  {currentCard.description}
                </p>

                {/* Info Row */}
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5">
                    <Star className="w-4 h-4 text-white fill-white" />
                    <span className="text-sm font-bold text-white">5.0</span>
                  </div>
                  <span className="text-sm text-white/80 font-medium">
                    {currentCard.cost}
                  </span>
                  <span className="text-sm text-white/80 font-medium">
                    {currentCard.duration}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Counter */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-sm text-gray-500 font-medium">
              {currentCardIndex + 1} / {cards.length}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-12 h-12 text-green-600 fill-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              All Done! 🎉
            </h3>
            <p className="text-gray-600 mb-6">
              You've reviewed all opportunities
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 space-y-3">
        {currentCard && (
          <div className="flex items-center justify-center gap-6 mb-4">
            {/* Reject Button */}
            <button
              onClick={handleReject}
              className="w-16 h-16 glass-button rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-lg border-2 border-red-500/50"
            >
              <X className="w-8 h-8 text-red-400" strokeWidth={3} />
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAccept}
              className="w-20 h-20 glass-gradient-button rounded-full flex items-center justify-center hover:scale-110 hover:shadow-2xl transition-all shadow-xl shine-overlay"
            >
              <Heart className="w-10 h-10 text-white fill-white" />
            </button>
          </div>
        )}

        {/* Submit Plan Button */}
        {acceptedCards.length > 0 && (
          <button
            onClick={handleSubmitPlan}
            className="w-full py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all glass-gradient-button shine-overlay"
          >
            <span>Submit Plan ({acceptedCards.length})</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
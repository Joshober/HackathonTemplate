import { Plane, Hotel, DollarSign, Star, CheckCircle2 } from "lucide-react";
import { flightOptions, hotelOptions } from "../../../data/mockData";
import { toast } from "sonner";

export function BookingOptimization() {
  const totalCost =
    parseInt(flightOptions[0].price.replace(/[$,]/g, "")) +
    parseInt(hotelOptions[0].price.replace(/[$,/night]/g, "")) * 3;

  const handleFinalize = () => {
    toast.success("Booking finalized! Moving to Travel stage.");
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-purple-600" />
          Booking Options
        </h1>
        <p className="text-gray-600">AI-optimized recommendations for your trip</p>
      </div>

      {/* Total Cost Summary */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 text-white mb-6">
        <div className="text-sm text-purple-100 mb-1">Total Estimated Cost</div>
        <div className="text-4xl font-bold mb-2">${totalCost.toLocaleString()}</div>
        <div className="text-sm text-purple-100">
          Flight + 3 nights hotel • San Francisco
        </div>
      </div>

      {/* Flight Options */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Plane className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Flight Options</h2>
        </div>
        <div className="space-y-3">
          {flightOptions.map((flight) => (
            <div
              key={flight.id}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                flight.best
                  ? "border-purple-500 shadow-lg shadow-purple-100"
                  : "border-gray-200"
              }`}
            >
              {flight.best && (
                <div className="flex items-center gap-1 text-purple-600 text-xs font-bold mb-2">
                  <Star className="w-4 h-4 fill-purple-600" />
                  AI RECOMMENDED
                </div>
              )}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {flight.airline}
                  </h3>
                  <p className="text-sm text-gray-600">{flight.stops}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    {flight.price}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t border-gray-100">
                <span>{flight.departure} → {flight.arrival}</span>
                <span>{flight.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hotel Options */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Hotel className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Hotel Options</h2>
        </div>
        <div className="space-y-3">
          {hotelOptions.map((hotel) => (
            <div
              key={hotel.id}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                hotel.best
                  ? "border-purple-500 shadow-lg shadow-purple-100"
                  : "border-gray-200"
              }`}
            >
              {hotel.best && (
                <div className="flex items-center gap-1 text-purple-600 text-xs font-bold mb-2">
                  <Star className="w-4 h-4 fill-purple-600" />
                  AI RECOMMENDED
                </div>
              )}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{hotel.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(Math.floor(hotel.rating))].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3 h-3 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                    <span className="text-sm text-gray-600 ml-1">
                      {hotel.rating}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{hotel.distance}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {hotel.price}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                {hotel.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finalize Button */}
      <button
        onClick={handleFinalize}
        className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30"
      >
        <CheckCircle2 className="w-5 h-5" />
        Finalize Booking
      </button>
    </div>
  );
}

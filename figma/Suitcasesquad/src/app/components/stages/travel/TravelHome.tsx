import { useNavigate } from "react-router";
import { Vote, Users, Calendar, ArrowRight, TrendingUp } from "lucide-react";
import { destinations } from "../../../data/mockData";

export function TravelHome() {
  const navigate = useNavigate();

  const votingOptions = destinations.slice(0, 3).map((dest, index) => ({
    ...dest,
    votes: [3, 2, 1][index],
    totalVoters: 4,
  }));

  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Travel Coordination
        </h1>
        <p className="text-gray-600">Vote on final travel options with your team</p>
      </div>

      {/* Voting Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-3xl font-bold text-green-600">
            {votingOptions[0].votes}
          </div>
          <div className="text-sm text-gray-600 mt-1">Top Votes</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">4</div>
          <div className="text-sm text-gray-600 mt-1">Team Members</div>
        </div>
      </div>

      {/* Voting Options */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Vote className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">Vote for Your Preferred Option</h2>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {votingOptions.map((option, index) => (
          <div
            key={option.id}
            className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
              index === 0
                ? "border-green-500 shadow-lg shadow-green-100"
                : "border-gray-200"
            }`}
          >
            {index === 0 && (
              <div className="bg-green-500 text-white px-4 py-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-bold">MOST POPULAR</span>
              </div>
            )}
            <img
              src={option.image}
              alt={option.name}
              className="w-full h-32 object-cover"
            />
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {option.name}
              </h3>
              <p className="text-sm text-gray-600 mb-3">{option.description}</p>

              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-700">
                  <span className="font-bold text-lg">{option.votes}</span>
                  <span className="text-gray-500">/{option.totalVoters} votes</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {option.cost}
                </div>
              </div>

              {/* Vote Progress */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(option.votes / option.totalVoters) * 100}%`,
                  }}
                />
              </div>

              <button className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
                Vote for {option.name}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* View Calendar CTA */}
      <button
        onClick={() => navigate("/calendar")}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-500/30"
      >
        <Calendar className="w-5 h-5" />
        View Team Calendar
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Info */}
      <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
        <div className="text-sm font-semibold text-green-900 mb-1">
          What's Next?
        </div>
        <div className="text-sm text-green-700">
          Check the calendar to find the best dates that work for everyone
        </div>
      </div>
    </div>
  );
}

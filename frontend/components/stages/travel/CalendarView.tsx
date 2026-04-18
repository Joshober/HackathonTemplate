import { Calendar, DollarSign, Users, Sparkles } from "lucide-react";
import { teamMembers } from "../../../data/mockData";

const calendarDays = [
  { date: "Apr 21", day: "Mon", available: [true, true, false, true], price: "$2,450" },
  { date: "Apr 22", day: "Tue", available: [true, true, true, true], price: "$2,280", best: true },
  { date: "Apr 23", day: "Wed", available: [true, false, true, true], price: "$2,350" },
  { date: "Apr 24", day: "Thu", available: [false, true, true, true], price: "$2,520" },
  { date: "Apr 25", day: "Fri", available: [true, true, true, false], price: "$2,890" },
];

export function CalendarView() {
  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-green-600" />
          Team Calendar
        </h1>
        <p className="text-gray-600">Find the best time for everyone</p>
      </div>

      {/* Team Availability Legend */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          Team Members
        </div>
        <div className="grid grid-cols-2 gap-2">
          {teamMembers.filter((m) => m.participating).map((member) => (
            <div key={member.id} className="flex items-center gap-2">
              <img
                src={member.avatar}
                alt={member.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm text-gray-700">{member.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-3 mb-6">
        {calendarDays.map((day) => {
          const availableCount = day.available.filter((a) => a).length;
          const totalMembers = day.available.length;

          return (
            <div
              key={day.date}
              className={`bg-white rounded-xl p-4 border-2 transition-all ${
                day.best
                  ? "border-green-500 shadow-lg shadow-green-100"
                  : "border-gray-200"
              }`}
            >
              {day.best && (
                <div className="flex items-center gap-1 text-green-600 text-xs font-bold mb-2">
                  <Sparkles className="w-4 h-4" />
                  AI RECOMMENDED - Best for all
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{day.date}</h3>
                  <p className="text-sm text-gray-600">{day.day}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Est. Cost</div>
                  <div className="text-lg font-bold text-gray-900">{day.price}</div>
                </div>
              </div>

              {/* Availability Grid */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {availableCount}/{totalMembers} available
                  </span>
                </div>
                <div className="flex gap-2">
                  {day.available.map((isAvailable, index) => (
                    <div
                      key={index}
                      className={`w-8 h-8 rounded-full ${
                        isAvailable ? "bg-green-500" : "bg-red-500"
                      }`}
                      title={teamMembers.filter((m) => m.participating)[index]?.name}
                    />
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(availableCount / totalMembers) * 100}%` }}
                />
              </div>

              <button
                className={`w-full py-2 rounded-lg font-medium transition-colors ${
                  availableCount === totalMembers
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Select {day.date}
              </button>
            </div>
          );
        })}
      </div>

      {/* Smart Suggestions */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-green-600" />
          <div className="text-sm font-semibold text-green-900">
            Smart Suggestions
          </div>
        </div>
        <div className="space-y-1 text-sm text-green-700">
          <div>• Apr 22 has full team availability</div>
          <div>• Booking 2 weeks ahead saves ~$180</div>
          <div>• Wednesday flights are typically cheaper</div>
        </div>
      </div>
    </div>
  );
}

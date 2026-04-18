import { useNavigate } from "react-router";
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { approvals } from "../../../data/mockData";

export function ApprovalHome() {
  const navigate = useNavigate();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "needs-changes":
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700 border-green-200";
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "needs-changes":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Pending";
      case "needs-changes":
        return "Needs Changes";
      default:
        return status;
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Approval Status
        </h1>
        <p className="text-gray-600">Track your trip approval progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {approvals.filter((a) => a.status === "approved").length}
          </div>
          <div className="text-xs text-gray-600 mt-1">Approved</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">
            {approvals.filter((a) => a.status === "pending").length}
          </div>
          <div className="text-xs text-gray-600 mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-orange-600">
            {approvals.filter((a) => a.status === "needs-changes").length}
          </div>
          <div className="text-xs text-gray-600 mt-1">Changes</div>
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="space-y-4 mb-6">
        {approvals.map((approval, index) => (
          <div
            key={approval.id}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {approval.trip}
                </h3>
                <p className="text-sm text-gray-600">{approval.approver}</p>
                <p className="text-xs text-gray-500">{approval.role}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusIcon(approval.status)}
                <span className="text-xs text-gray-500">{approval.timestamp}</span>
              </div>
            </div>

            <div
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${getStatusColor(
                approval.status
              )}`}
            >
              {getStatusLabel(approval.status)}
            </div>

            {approval.note && (
              <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-sm text-orange-900">{approval.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate("/booking")}
        className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30"
      >
        View Booking Options
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Next Steps */}
      <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
        <div className="text-sm font-semibold text-purple-900 mb-1">
          What's Next?
        </div>
        <div className="text-sm text-purple-700">
          Once all approvals are complete, you can finalize booking options
        </div>
      </div>
    </div>
  );
}

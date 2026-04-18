import { useState, useEffect } from "react";
import { Send, Crown, Rocket, Users, Plus, MessageCircle, X, Mail, UserPlus, ChevronDown, XCircle, Trash2 } from "lucide-react";
import { teamMembers, teamChatMessages } from "../../data/mockData";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { usePlanning } from "../../context/PlanningContext";

interface Group {
  id: number;
  name: string;
  members: number[];
  messages: any[];
  createdBy: number;
}

export function Team() {
  const navigate = useNavigate();
  const { isPlanningActive, startPlanning, cancelPlanning, setIsLeader: setPlanningLeader } = usePlanning();
  const [currentUserId] = useState(1); // Sarah Chen (team leader)
  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const isLeader = currentUser?.isLeader || false;

  // Set planning leader state
  useEffect(() => {
    setPlanningLeader(isLeader);
  }, [isLeader, setPlanningLeader]);

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newMessage, setNewMessage] = useState("");

  // Modals state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    const newGroup: Group = {
      id: Date.now(),
      name: newGroupName,
      members: [currentUserId],
      messages: [],
      createdBy: currentUserId,
    };

    setGroups([...groups, newGroup]);
    setNewGroupName("");
    setShowCreateGroupModal(false);
    toast.success(`Group "${newGroupName}" created!`);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedGroup) return;

    const newMsg = {
      id: Date.now(),
      senderId: currentUserId,
      senderName: currentUser?.name || "You",
      senderAvatar: currentUser?.avatar || "",
      content: newMessage,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };

    const updatedGroups = groups.map(g => 
      g.id === selectedGroup.id 
        ? { ...g, messages: [...g.messages, newMsg] }
        : g
    );
    
    setGroups(updatedGroups);
    setSelectedGroup({ ...selectedGroup, messages: [...selectedGroup.messages, newMsg] });
    setNewMessage("");
  };

  const handleStartPlanning = () => {
    if (!selectedGroup) return;
    startPlanning(selectedGroup.id);
    toast.success("Starting new planning session!");
    navigate("/");
  };

  const handleCancelPlanning = () => {
    cancelPlanning();
    toast.success("Planning session cancelled");
  };

  const handleRemoveGroup = () => {
    if (!selectedGroup) return;
    setGroups(groups.filter(g => g.id !== selectedGroup.id));
    setSelectedGroup(null);
    toast.success("Left the group");
  };

  const handleInviteMember = () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    toast.success(`Invitation sent to ${inviteEmail}!`);
    setInviteEmail("");
    setShowInviteModal(false);
  };

  const groupMembers = selectedGroup 
    ? teamMembers.filter(m => selectedGroup.members.includes(m.id))
    : [];

  // Empty State - No groups created
  if (groups.length === 0) {
    return (
      <div className="max-w-md mx-auto h-full flex flex-col bg-gray-50">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <MessageCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Groups Yet</h2>
          <p className="text-gray-600 text-center mb-8 max-w-xs">
            Create your first group to start chatting with your team members
          </p>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-bold flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Group</span>
          </button>
        </div>

        {/* Create Group Modal */}
        {showCreateGroupModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Create Group</h3>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                placeholder="Enter group name..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleCreateGroup}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Create Group
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Groups List View - When no group is selected
  if (!selectedGroup) {
    return (
      <div className="max-w-md mx-auto h-full flex flex-col bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-3">
            {groups.map((group) => {
              const lastMessage = group.messages[group.messages.length - 1];
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{group.name}</h3>
                      <p className="text-sm text-gray-500">
                        {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                        {lastMessage && ` · ${lastMessage.timestamp}`}
                      </p>
                    </div>
                  </div>
                  {lastMessage && (
                    <p className="text-sm text-gray-600 mt-2 truncate">
                      {lastMessage.senderName}: {lastMessage.content}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Group Modal */}
        {showCreateGroupModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Create Group</h3>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                placeholder="Enter group name..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleCreateGroup}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Create Group
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Chat View - When a group is selected
  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Group Members */}
        <div className="w-24 bg-gray-50 border-r border-gray-200 flex flex-col py-4 overflow-y-auto">
          <div className="px-2 mb-3">
            <button
              onClick={() => setSelectedGroup(null)}
              className="w-full px-2 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-[10px] font-bold text-gray-700 mb-3"
            >
              ← Back
            </button>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Members</h3>
          </div>
          
          <div className="space-y-3 px-2 mb-3">
            {groupMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                  />
                  {member.isLeader && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                      <Crown className="w-3 h-3 text-yellow-900 fill-yellow-900" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-[9px] text-gray-600 text-center leading-tight max-w-full truncate">
                  {member.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Add Team Members Button */}
          <div className="px-2 mt-auto space-y-2">
            {/* Cancel Planning / Remove Group Button */}
            {isLeader ? (
              <button
                onClick={handleCancelPlanning}
                className="w-full px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold flex flex-col items-center gap-1 transition-all"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-center leading-tight">Cancel Planning</span>
              </button>
            ) : (
              <button
                onClick={handleRemoveGroup}
                className="w-full px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold flex flex-col items-center gap-1 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-center leading-tight">Remove Group</span>
              </button>
            )}
            
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[9px] font-bold flex flex-col items-center gap-1 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-center leading-tight">Add Member</span>
            </button>
          </div>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{selectedGroup.name}</h2>
                <p className="text-xs text-gray-500">{groupMembers.length} members</p>
              </div>
              
              {/* Start Planning Button - Only for leader */}
              {isLeader && (
                <button
                  onClick={handleStartPlanning}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:shadow-md transition-all"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Start Planning</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {selectedGroup.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No messages yet</p>
                <p className="text-gray-400 text-xs">Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedGroup.messages.map((message) => {
                  const isCurrentUser = message.senderId === currentUserId;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isCurrentUser && (
                        <img
                          src={message.senderAvatar}
                          alt={message.senderName}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                      )}
                      
                      <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        {!isCurrentUser && (
                          <span className="text-xs text-gray-600 mb-1 px-1">{message.senderName}</span>
                        )}
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isCurrentUser
                              ? 'bg-gray-900 text-white rounded-tr-sm'
                              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 px-1">{message.timestamp}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-gray-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  newMessage.trim()
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Invite Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInviteMember()}
                  placeholder="colleague@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <button
              onClick={handleInviteMember}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5" />
              <span>Send Invitation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
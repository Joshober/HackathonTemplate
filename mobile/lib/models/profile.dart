class Profile {
  final String? id;
  final String? userId;
  final String displayName;
  final String bio;
  final String? profileImageUrl;
  final String? createdAt;
  final String? updatedAt;

  const Profile({
    this.id,
    this.userId,
    required this.displayName,
    required this.bio,
    this.profileImageUrl,
    this.createdAt,
    this.updatedAt,
  });

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['_id'] as String?,
      userId: json['userId'] as String?,
      displayName: json['displayName'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      profileImageUrl: json['profileImageUrl'] as String?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        if (id != null) '_id': id,
        if (userId != null) 'userId': userId,
        'displayName': displayName,
        'bio': bio,
        if (profileImageUrl != null) 'profileImageUrl': profileImageUrl,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };
}

class User {
  final String sub;
  final String name;
  final String email;
  final String picture;
  final String nickname;

  const User({
    required this.sub,
    required this.name,
    required this.email,
    this.picture = '',
    this.nickname = '',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      sub: json['sub'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      picture: json['picture'] as String? ?? '',
      nickname: json['nickname'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'sub': sub,
        'name': name,
        'email': email,
        'picture': picture,
        'nickname': nickname,
      };
}

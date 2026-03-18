// Authentication protocol and service implementation

import Foundation

protocol Authenticatable {
    func login(email: String, password: String) async throws -> AuthToken
    func verify(token: String) async throws -> User
}

class AuthService: Authenticatable {
    private let secret: String

    init(secret: String) {
        self.secret = secret
    }

    func login(email: String, password: String) async throws -> AuthToken {
        guard !email.isEmpty else {
            throw AuthError.invalidCredentials
        }
        let user = User(id: "1", email: email, name: "Admin", role: .admin)
        return generateToken(for: user)
    }

    func verify(token: String) async throws -> User {
        let parts = token.components(separatedBy: ".")
        guard let userId = parts.first else {
            throw AuthError.tokenExpired
        }
        return User(id: userId, email: "admin@example.com", name: "Admin", role: .admin)
    }

    private func generateToken(for user: User) -> AuthToken {
        AuthToken(
            accessToken: "\(user.id).\(secret)",
            refreshToken: "refresh.\(user.id)",
            expiresIn: 3600
        )
    }
}

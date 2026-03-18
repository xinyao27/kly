// Data models: structs and enums for keyword detection testing

import Foundation

struct User {
    let id: String
    let email: String
    let name: String
    let role: UserRole
}

struct AuthToken {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

enum UserRole: String {
    case admin
    case member
    case guest
}

enum AuthError: Error {
    case invalidCredentials
    case tokenExpired
    case unauthorized
}

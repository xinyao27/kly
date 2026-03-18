// Type extensions for convenience methods

import Foundation

extension User {
    var isAdmin: Bool {
        role == .admin
    }

    func displayName() -> String {
        "\(name) (\(email))"
    }
}

extension AuthToken {
    var isExpired: Bool {
        expiresIn <= 0
    }
}

extension String {
    func slugified() -> String {
        lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
    }
}

extension Date {
    func formatted() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}

// Application entry point with protocol conformance

import Foundation

protocol AppLifecycle {
    func start() async throws
    func shutdown() async
}

@main
struct App: AppLifecycle {
    static func main() async {
        let app = App()
        do {
            try await app.start()
        } catch {
            print("Failed to start: \(error)")
        }
    }

    func start() async throws {
        let auth = AuthService(secret: "dev-secret")
        let token = try await auth.login(email: "admin@example.com", password: "pass")
        print("Started with token: \(token.accessToken)")
    }

    func shutdown() async {
        print("Shutting down...")
    }
}

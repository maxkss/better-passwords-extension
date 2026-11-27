import Foundation
import Testing

@testable import CompanionCore

private let home = URL(fileURLWithPath: "/Users/jane")
private func app(_ path: String) -> URL { URL(fileURLWithPath: path) }

@Suite struct InstallationTests {
    @Test func acceptsApplicationsFolders() {
        #expect(Installation.isInApplications(app("/Applications/Passwords Plus.app"), home: home))
        #expect(Installation.isInApplications(app("/Applications/Utilities/Passwords Plus.app"), home: home))
        #expect(Installation.isInApplications(app("/Users/jane/Applications/Passwords Plus.app"), home: home))
    }

    @Test func refusesEverywhereElse() {
        #expect(!Installation.isInApplications(app("/Users/jane/Downloads/Passwords Plus.app"), home: home))
        #expect(!Installation.isInApplications(app("/Volumes/Passwords Plus/Passwords Plus.app"), home: home))
        #expect(
            !Installation.isInApplications(
                app("/private/var/folders/xy/T/AppTranslocation/0A1B/d/Passwords Plus.app"), home: home))
        // a lookalike folder, and a path that only climbs back out of Applications
        #expect(!Installation.isInApplications(app("/Applications Old/Passwords Plus.app"), home: home))
        #expect(!Installation.isInApplications(app("/Applications/../Users/jane/Passwords Plus.app"), home: home))
    }

    @Test func movesToTheSystemFolderWhenItCan() {
        let downloaded = app("/Users/jane/Downloads/Passwords Plus.app")
        #expect(
            Installation.destination(for: downloaded, home: home, canWriteSystemApplications: true).path
                == "/Applications/Passwords Plus.app")
        #expect(
            Installation.destination(for: downloaded, home: home, canWriteSystemApplications: false).path
                == "/Users/jane/Applications/Passwords Plus.app")
    }
}

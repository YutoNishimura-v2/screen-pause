import SwiftUI

struct LegalLinks: View {
    var body: some View {
        ForEach(Document.allCases, id: \.self) { document in
            if let url = document.publicURL {
                Link(document.title, destination: url)
            } else {
                NavigationLink(document.title) {
                    document.localPage
                }
            }
        }
    }
}

private enum Document: String, CaseIterable {
    case terms, privacy

    var title: String {
        switch self {
        case .terms: "利用規約"
        case .privacy: "プライバシーポリシー"
        }
    }

    var publicURL: URL? {
        let setting = "LegalBaseURL"
        guard let value = Bundle.main.object(forInfoDictionaryKey: setting) as? String,
              let url = URL(string: value), url.scheme == "https", url.host?.isEmpty == false else {
            return nil
        }
        return url.appendingPathComponent(rawValue).appendingPathExtension("html")
    }

    var localPage: some View {
        ScrollView {
            if let url = Bundle.main.url(forResource: rawValue, withExtension: "md"),
               let markdown = try? String(contentsOf: url, encoding: .utf8) {
                // Skip the Jekyll front matter and use the navigation title as the page heading.
                let body = markdown.split(whereSeparator: \.isNewline).dropFirst(4)
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(body.enumerated()), id: \.offset) { _, line in
                        if line.hasPrefix("## ") {
                            Text(line.dropFirst(3)).font(.headline).accessibilityAddTraits(.isHeader)
                        } else {
                            Text(LocalizedStringKey(String(line)))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            } else {
                Text("文書を読み込めませんでした。")
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

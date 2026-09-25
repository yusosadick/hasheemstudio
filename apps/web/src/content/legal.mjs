// Single source for the Privacy Policy and Terms of Service. Rendered by the React pages AND baked into static
// HTML at build time (scripts/seo-prerender.mjs) so crawlers read the full text without running JavaScript.
// Every factual claim below is tied to how the service actually works (retention, data stored, processors).
// This is not legal advice; the owner should have it reviewed by a qualified lawyer.

export const SUPPORT_EMAIL = "support@hasheemstudio.com";
const UPDATED = "25 September 2026";

const privacy = {
  title: "Privacy Policy",
  description: "How Hasheem Studio collects, uses, stores and deletes your data: accounts, uploaded videos, payments, cookies, retention periods and your rights.",
  updated: UPDATED,
  intro: [
    "Hasheem Studio (“Hasheem Studio”, “we”, “us”) prepares your videos for publishing on platforms such as TikTok, Instagram and WhatsApp. This Privacy Policy explains what personal data we handle, why, how long we keep it and what control you have. It applies to hasheemstudio.com and the services behind it (together, the “Service”).",
    "The short version: we process your video only to give you the result you asked for, we delete uploads and results automatically after a short period, we do not sell your data, and we do not use your videos to train AI models or for advertising.",
  ],
  sections: [
    { id: "who-we-are", title: "1. Who is responsible for your data", body: [
      "The Service is operated by Bisso Technologies Ltd. (the “operator”) and developed by Yusuf Sadick. For the purposes of data-protection law the operator is the controller of the personal data described in this policy.",
      `You can contact us about privacy at ${SUPPORT_EMAIL}.`,
    ] },
    { id: "data-we-collect", title: "2. Information we collect", body: [
      "We collect only what is needed to run the Service.",
      { list: [
        "Account data: your email address, your password (stored only as a salted hash by our authentication system, never in readable form), and one-time verification codes. If you choose Google Sign-In we also receive your name, email address and profile picture from Google.",
        "Your videos: the MP4 or MOV files you upload, the file name, and technical properties read from the file (for example container, codec, resolution, frame rate, duration, size and colour information). We also store the processed output we create for you and the automated check results that confirm it plays correctly.",
        "Guest use: if you use the Service before signing in, we place a random token in your browser to keep your upload and result together, and we keep a one-way cryptographic hash of your network address to enforce the daily guest limit. We cannot reverse that hash into your address.",
        "Payment records: when you buy a paid plan we store the plan, amount, currency, status, our internal reference, the payment provider’s reference and timestamps. To start a mobile-money payment we send your mobile number, first name, last name and email to our payment provider, Snippe. Our systems do not store your mobile number or your wallet PIN, and we never see your PIN.",
        "Technical and security data: IP address, browser type, requested pages, timestamps, error events and abuse-prevention signals, held in server logs.",
        "Messages: anything you send to our support address, and our replies.",
      ] },
    ] },
    { id: "cookies", title: "3. Cookies and similar storage", body: [
      "We do not use advertising or analytics cookies and we do not run third-party trackers. The Service uses your browser’s local storage and session storage only for things it needs to work: your sign-in session, the guest token described above, and temporary interface state. Clearing your browser data signs you out and forgets a guest session; it does not delete files already stored on our servers, which expire automatically as described in section 6.",
    ] },
    { id: "how-we-use", title: "4. How we use information and why", body: [
      { list: [
        "To provide the Service: receive your upload, process it, verify the result and let you download it (performance of our contract with you).",
        "To run accounts and payments: authenticate you, apply plan limits and quotas, confirm payments and activate plans (contract).",
        "To keep the Service safe: detect abuse, hostile or malformed files, fraud and attacks; enforce limits (legitimate interests and legal obligations).",
        "To communicate: send verification codes, security notices and replies to your requests (contract and legitimate interests).",
        "To improve reliability: investigate errors and capacity using aggregated technical data (legitimate interests).",
        "To comply with law: keep financial records and respond to lawful requests (legal obligation).",
      ] },
      "We do not sell your personal data, we do not use it for advertising, and we do not use your videos to train machine-learning models.",
    ] },
    { id: "your-videos", title: "5. What happens to your videos", body: [
      "Your video is processed automatically by software running on our own servers. We do not watch, review or share your videos as a matter of routine. A person may access a file only where strictly necessary to investigate a security incident, to respond to a lawful request, to enforce our Terms (for example a report of illegal content), or to fix a fault you have asked us to look into.",
      "Uploads and results are private. Download links are issued only after we check your account and allowance, and expire within a few hours. We do not publish your videos or make them publicly accessible.",
    ] },
    { id: "retention", title: "6. How long we keep data", body: [
      { list: [
        "Uploaded source videos: deleted automatically 7 days after upload for signed-in accounts and 1 day after upload for guests.",
        "Processed results: deleted automatically 7 days after they are created. After that the result page tells you the file has expired and it cannot be recovered.",
        "Account data: kept while your account exists. You can ask us to delete your account at any time; see section 10.",
        "Payment records: kept for as long as accounting, tax and anti-fraud rules require, even if you delete your account.",
        "Server logs and security records: kept for a limited period needed for security and troubleshooting, then deleted or anonymised.",
        "Backups: our database is backed up in encrypted form. Data you delete may remain in backups until they rotate out; it is not restored except to recover from a failure.",
      ] },
    ] },
    { id: "sharing", title: "7. Who we share data with", body: [
      "We share personal data only with service providers that help us run the Service, under obligations to protect it, and only what they need:",
      { list: [
        "Snippe: processes mobile-money payments for paid plans.",
        "Resend: delivers our verification and account emails.",
        "Google: only if you choose Google Sign-In.",
        "Hosting and network providers: the servers and network that run the Service, and DNS.",
      ] },
      "We host our own database, authentication and file storage; your videos are not sent to any third-party video, cloud-AI or storage service. We may disclose information if required by law, court order or a valid request from a competent authority, or to protect the rights, safety and security of our users, the public or the Service. If the business is reorganised or transferred, data may move to the successor under this policy.",
    ] },
    { id: "transfers", title: "8. International transfers", body: [
      "Our infrastructure and our providers may be located outside your country. Where personal data is transferred across borders we take steps to ensure it remains protected as this policy describes and as applicable law requires.",
    ] },
    { id: "security", title: "9. How we protect data", body: [
      { list: [
        "Encrypted connections (HTTPS/TLS) for all traffic to the Service.",
        "Private file storage: no public access to uploads or results; short-lived, per-file download links issued only after authorisation.",
        "Row-level access controls so accounts can only reach their own data.",
        "Sandboxed, resource-limited media processing that treats every uploaded file as untrusted.",
        "Encrypted backups and protected, non-shared credentials.",
        "Rate-limiting and abuse detection.",
      ] },
      "No system is perfectly secure. If a breach affecting your personal data occurs we will notify you and the relevant authority as the law requires.",
    ] },
    { id: "rights", title: "10. Your rights and choices", body: [
      "Depending on where you live (including under Tanzania’s Personal Data Protection Act, 2022 and, where applicable, other data-protection laws such as the GDPR) you may have the right to:",
      { list: [
        "access the personal data we hold about you and receive a copy;",
        "correct inaccurate data;",
        "delete your data and account (“erasure”), subject to records we must keep by law;",
        "object to or restrict certain processing, and withdraw consent where we rely on it;",
        "receive your data in a portable format;",
        "complain to a data-protection authority, such as Tanzania’s Personal Data Protection Commission, or the authority in your country.",
      ] },
      `To exercise a right, email ${SUPPORT_EMAIL} from the address on your account. We may need to verify your identity, and we aim to respond within 30 days. You can also remove any video earlier than its automatic expiry by asking us to delete it.`,
    ] },
    { id: "children", title: "11. Children", body: [
      "The Service is not directed at children under 18 and we do not knowingly collect their personal data. If you believe a child has given us data, contact us and we will delete it.",
    ] },
    { id: "third-party-links", title: "12. Links to other sites", body: [
      "The Service may link to other sites, for example the developer’s website and social profile. We do not control those sites and this policy does not cover them.",
    ] },
    { id: "changes", title: "13. Changes to this policy", body: [
      "We may update this policy as the Service changes. The “Last updated” date above shows the current version. If a change is significant we will give notice on the Service or by email before it takes effect.",
    ] },
    { id: "contact", title: "14. Contact", body: [
      `Questions or requests: ${SUPPORT_EMAIL}.`,
    ] },
  ],
};

const terms = {
  title: "Terms of Service",
  description: "The rules for using Hasheem Studio: accounts, acceptable use, plans and payments, your content, limits, refunds, disclaimers and liability.",
  updated: UPDATED,
  intro: [
    "These Terms of Service (“Terms”) are a binding agreement between you and Bisso Technologies Ltd. (the “operator”, “we”, “us”), which operates Hasheem Studio at hasheemstudio.com (the “Service”). By using the Service, creating an account or paying for a plan you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.",
  ],
  sections: [
    { id: "service", title: "1. What the Service does", body: [
      "Hasheem Studio lets you upload a video, prepares it as a compatible MP4 (for example smaller, with standard video and audio formats), checks that the result plays from start to end, and lets you download it. The Service is currently in public beta: features, limits and prices may change, and it may be interrupted.",
    ] },
    { id: "eligibility", title: "2. Eligibility and accounts", body: [
      { list: [
        "You must be at least 18 years old, or have the consent of a parent or legal guardian, and be able to form a binding contract.",
        "You may use the Service as a guest, but you must sign in with a verified email to download results.",
        "Give accurate information and keep your credentials and verification codes private. You are responsible for all activity under your account. Tell us immediately if you suspect unauthorised use.",
        "One person, one account. Do not create accounts to get around limits or bans.",
      ] },
    ] },
    { id: "acceptable-use", title: "3. Acceptable use", body: [
      "You must not use the Service to upload, process or distribute:",
      { list: [
        "anything that is illegal, or that you do not have the right to use (including material that infringes copyright, trademark, privacy or publicity rights);",
        "child sexual abuse material or any content that sexually exploits or endangers minors. We report such content to the authorities and terminate access immediately;",
        "content that promotes violence, terrorism, human trafficking, or that harasses, threatens or defames others;",
        "malware, malformed or hostile files, or anything designed to harm, overload or probe the Service.",
      ] },
      "You also must not:",
      { list: [
        "bypass or attempt to bypass limits, quotas, authentication, payment or security controls;",
        "scrape, crawl or use bots or automated means to use the Service, except through interfaces we provide;",
        "reverse engineer, decompile or attempt to extract or replicate our processing methods, settings, thresholds or software, or use the Service to build a competing product;",
        "resell or sublicense the Service, or share your account or download links;",
        "interfere with other users or with the operation of the Service.",
      ] },
    ] },
    { id: "your-content", title: "4. Your content and licence to us", body: [
      "You keep all rights in your videos. You confirm that you own them or have every permission needed to upload and process them, and that doing so does not violate any law or third-party right.",
      "You give us a limited, non-exclusive, worldwide, royalty-free licence to receive, store, process, convert and deliver your video to you, only to operate the Service for you and only for the retention periods in the Privacy Policy. We do not claim ownership of your content, use it for advertising or use it to train AI models.",
      "You are responsible for what you publish with the results. Keep your original files: we are not a backup service.",
    ] },
    { id: "results", title: "5. Results and platform compatibility", body: [
      "Converting a video to a smaller file involves re-encoding, which is lossy. We aim to keep visible quality high, but the output is not identical to the original. Always check the result before you publish.",
      "We build results to the technical specifications that platforms such as TikTok, Instagram and WhatsApp publish. “Ready for social upload” and similar statements describe a technical check, not a guarantee. Platforms change their requirements, and may still recompress, restrict or reject a video for reasons outside our control, including their own content rules. We are not responsible for a platform’s decision.",
      "Some inputs cannot be processed (for example damaged, unsupported or very long files). In that case the Service tells you, and no plan quota is used.",
    ] },
    { id: "plans", title: "6. Plans, limits and quotas", body: [
      "The plans currently offered are:",
      { list: [
        "Free: 1 video download per day (UTC day), up to 100 MB and 2 minutes per video, up to 1080p at 60 frames per second.",
        "Weekly: 2,000 Tanzanian shillings (TZS) for up to 20 video downloads within 7 days.",
        "Monthly: 5,000 TZS for up to 50 video downloads within 30 days.",
      ] },
      "Paid plans add to, and do not replace, the free daily video. A “video download” is one distinct processed video that you unlock; downloading the same video again does not use more of your allowance. Unused videos do not carry over after a plan expires. Plan availability, prices and limits may change; changes do not affect a plan you have already paid for. Prices include applicable taxes unless we state otherwise.",
    ] },
    { id: "payments", title: "7. Payments and refunds", body: [
      { list: [
        "Paid plans are one-time purchases paid by mobile money through our payment provider, Snippe. Plans do not renew automatically.",
        "A plan is activated only when the payment provider confirms your payment to us. If you are charged and your plan does not activate, or you are charged twice for the same plan, contact us within 14 days and we will fix it or refund you.",
        "Because access is delivered digitally and immediately, payments are otherwise non-refundable once you have used any part of a plan, except where the law gives you a right to a refund.",
        "You are responsible for any fees charged by your mobile-money provider or network.",
        "We may refuse or reverse a payment we reasonably believe is fraudulent or unauthorised.",
      ] },
    ] },
    { id: "availability", title: "8. Availability, retention and beta status", body: [
      "We work to keep the Service reliable but do not promise uninterrupted or error-free operation. Uploads and results are deleted automatically according to the retention periods in the Privacy Policy (currently 7 days for results). Download what you need before it expires; expired files cannot be recovered. We may change, suspend or discontinue any feature at any time, and will give notice of material changes where we reasonably can.",
    ] },
    { id: "ip", title: "9. Our intellectual property", body: [
      "The Service, including its software, design, text, graphics, the Hasheem Studio name and logos, and our processing methods, belongs to us or our licensors and is protected by law. We grant you a personal, limited, revocable, non-transferable right to use the Service under these Terms. All other rights are reserved. If you send us feedback, we may use it without obligation to you.",
    ] },
    { id: "third-parties", title: "10. Third-party services", body: [
      "The Service relies on third parties such as payment, email and sign-in providers. Their services are governed by their own terms, and we are not responsible for their acts or outages.",
    ] },
    { id: "copyright", title: "11. Copyright and content complaints", body: [
      `If you believe content on the Service infringes your rights or is unlawful, email ${SUPPORT_EMAIL} with: who you are, what you claim, where the content is (for example the link or job reference), why it is unlawful or infringing, and a statement that your notice is accurate. We may remove or disable access to the content and may terminate repeat infringers.`,
    ] },
    { id: "termination", title: "12. Suspension and termination", body: [
      "We may suspend or end your access, remove content and cancel plans without refund if you breach these Terms, put the Service or others at risk, or we are required to by law. You may stop using the Service and delete your account at any time by contacting us. Sections that by their nature should survive termination (including 4, 5, 9, 13–16) will survive.",
    ] },
    { id: "disclaimers", title: "13. Disclaimers", body: [
      "To the fullest extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, non-infringement, accuracy of results, or that the Service will meet your requirements or be uninterrupted, secure or error-free. Nothing in these Terms excludes rights you have under mandatory consumer law that cannot be excluded.",
    ] },
    { id: "liability", title: "14. Limitation of liability", body: [
      "To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, data, goodwill or opportunities (including a video being rejected or restricted by a platform), arising from your use of or inability to use the Service.",
      "Our total liability for any claim relating to the Service is limited to the amount you paid us in the 3 months before the event giving rise to the claim, or 10,000 TZS if you paid nothing. Nothing limits liability that cannot be limited by law, such as for fraud or wilful misconduct.",
    ] },
    { id: "indemnity", title: "15. Your responsibility (indemnity)", body: [
      "You agree to indemnify and hold harmless the operator, its developers and personnel from claims, losses and costs (including reasonable legal fees) arising from your content, your breach of these Terms or the law, or your infringement of another person’s rights.",
    ] },
    { id: "law", title: "16. Governing law and disputes", body: [
      "These Terms are governed by the laws of the United Republic of Tanzania, without regard to conflict-of-law rules. We will first try to resolve any dispute in good faith through discussion. If that fails, the courts of Tanzania have exclusive jurisdiction, except where mandatory law gives you the right to bring a claim elsewhere.",
    ] },
    { id: "changes", title: "17. Changes to these Terms", body: [
      "We may update these Terms. The “Last updated” date shows the current version. If a change is material we will give reasonable notice on the Service or by email. Continuing to use the Service after a change takes effect means you accept it.",
    ] },
    { id: "general", title: "18. General", body: [
      "These Terms and the Privacy Policy are the whole agreement between you and us about the Service. If a provision is unenforceable, the rest remains in effect. Our failure to enforce a right is not a waiver. You may not transfer your rights under these Terms; we may transfer ours as part of a reorganisation or sale of the business. We may provide notices to you through the Service or by email.",
    ] },
    { id: "contact", title: "19. Contact", body: [
      `Questions about these Terms: ${SUPPORT_EMAIL}.`,
    ] },
  ],
};

export const LEGAL = { privacy, terms };

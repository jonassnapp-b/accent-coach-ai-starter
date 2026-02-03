// src/data/aiChatScenarios.js

export const AI_CHAT_LEVELS = [
  {
    level: 1,
    scenarios: [
      { id: "l1_coffee_order", title: "Coffee Order", subtitle: "Order politely, handle a follow-up question", total: 13, emoji: "☕️", partnerName: "Mia", partnerTitle: "your Barista" },
      { id: "l1_smalltalk_neighbor", title: "Neighbor Small Talk", subtitle: "Keep it friendly and natural in the hallway", total: 13, emoji: "🏠", partnerName: "Daniel", partnerTitle: "your Neighbor" },
      { id: "l1_store_return", title: "Return at a Store", subtitle: "Explain why you’re returning an item", total: 13, emoji: "🛍️", partnerName: "Sofia", partnerTitle: "Store Assistant" },
      { id: "l1_ask_directions", title: "Ask for Directions", subtitle: "Ask and confirm you understood correctly", total: 13, emoji: "🗺️", partnerName: "Noah", partnerTitle: "a Local" },
      { id: "l1_gym_checkin", title: "Gym Check-in", subtitle: "Solve a simple membership/check-in issue", total: 13, emoji: "🏋️‍♂️", partnerName: "Emma", partnerTitle: "Front Desk" },
      { id: "l1_food_allergy", title: "Food Allergy", subtitle: "Ask about ingredients and alternatives", total: 13, emoji: "🥗", partnerName: "Luca", partnerTitle: "Waiter" },
      { id: "l1_book_appointment", title: "Book an Appointment", subtitle: "Choose time, confirm details, ask one question", total: 13, emoji: "📅", partnerName: "Nina", partnerTitle: "Receptionist" },
      { id: "l1_ride_smalltalk", title: "Ride Small Talk", subtitle: "Light conversation during a short ride", total: 13, emoji: "🚗", partnerName: "Omar", partnerTitle: "Driver" },
      { id: "l1_friend_plans", title: "Weekend Plans", subtitle: "Make plans and suggest an activity", total: 13, emoji: "🎉", partnerName: "Rachel", partnerTitle: "your Best Friend" },
      { id: "l1_phone_call_intro", title: "Quick Phone Intro", subtitle: "Introduce yourself and state your purpose", total: 13, emoji: "📞", partnerName: "Alex", partnerTitle: "Support Agent" },
    ],
  },

  {
    level: 2,
    scenarios: [
      { id: "l2_networking_event", title: "Networking Event", subtitle: "Introduce yourself and ask smart follow-ups", total: 13, emoji: "🤝", partnerName: "Kai", partnerTitle: "Event Attendee" },
      { id: "l2_team_standup", title: "Team Standup", subtitle: "Give a clear update and ask for help", total: 13, emoji: "🧑‍💻", partnerName: "Priya", partnerTitle: "Team Lead" },
      { id: "l2_customer_question", title: "Customer Question", subtitle: "Answer a basic product question confidently", total: 13, emoji: "💬", partnerName: "Jordan", partnerTitle: "Customer" },
      { id: "l2_restaurant_complaint", title: "Restaurant Issue", subtitle: "Politely fix a wrong order", total: 13, emoji: "🍽️", partnerName: "Marco", partnerTitle: "Manager" },
      { id: "l2_airport_checkin", title: "Airport Check-in", subtitle: "Confirm baggage and seat preferences", total: 13, emoji: "✈️", partnerName: "Hannah", partnerTitle: "Check-in Staff" },
      { id: "l2_new_friend_intro", title: "Meet a Friend’s Friend", subtitle: "Be confident and keep the conversation flowing", total: 13, emoji: "🙂", partnerName: "Chloe", partnerTitle: "New Friend" },
      { id: "l2_doctor_symptoms", title: "Describe Symptoms", subtitle: "Explain what you feel and answer questions", total: 13, emoji: "🩺", partnerName: "Dr. Patel", partnerTitle: "Doctor" },
      { id: "l2_landlord_request", title: "Ask Landlord for a Fix", subtitle: "Explain an issue and request a timeline", total: 13, emoji: "🔧", partnerName: "Ben", partnerTitle: "Landlord" },
      { id: "l2_group_dinner_split", title: "Split the Bill", subtitle: "Suggest a fair split and handle disagreement", total: 13, emoji: "🧾", partnerName: "Sarah", partnerTitle: "Friend" },
      { id: "l2_library_help", title: "Ask for Help", subtitle: "Explain what you need and clarify", total: 13, emoji: "📚", partnerName: "Elise", partnerTitle: "Librarian" },
    ],
  },

  {
    level: 3,
    scenarios: [
      { id: "l3_first_round_interview", title: "First-Round Interview", subtitle: "Talk about background, strengths, and goals", total: 13, emoji: "💼", partnerName: "Samantha", partnerTitle: "Recruiter" },
      { id: "l3_raise_conversation", title: "Ask for a Raise", subtitle: "Make a calm case with evidence", total: 13, emoji: "📈", partnerName: "Michael", partnerTitle: "your Manager" },
      { id: "l3_sales_discovery_call", title: "Discovery Call", subtitle: "Ask needs-based questions and summarize", total: 13, emoji: "📞", partnerName: "Taylor", partnerTitle: "Prospect" },
      { id: "l3_hotel_checkin_issue", title: "Hotel Room Issue", subtitle: "Solve a problem politely but firmly", total: 13, emoji: "🏨", partnerName: "Isabella", partnerTitle: "Front Desk" },
      { id: "l3_flight_delay_rebook", title: "Flight Delay Rebook", subtitle: "Rebook and negotiate options", total: 13, emoji: "⏳", partnerName: "Chris", partnerTitle: "Airline Agent" },
      { id: "l3_friend_boundary", title: "Set a Boundary", subtitle: "Say no without being awkward", total: 13, emoji: "🧠", partnerName: "Jason", partnerTitle: "Friend" },
      { id: "l3_customer_refund", title: "Refund Request", subtitle: "Handle a refund request professionally", total: 13, emoji: "💳", partnerName: "Ava", partnerTitle: "Customer" },
      { id: "l3_project_deadline", title: "Deadline Negotiation", subtitle: "Explain constraints and propose a plan", total: 13, emoji: "🗓️", partnerName: "Leo", partnerTitle: "Stakeholder" },
      { id: "l3_party_introduction", title: "Party Introduction", subtitle: "Join a group conversation naturally", total: 13, emoji: "🥂", partnerName: "Megan", partnerTitle: "Host" },
      { id: "l3_phone_support_troubleshoot", title: "Tech Troubleshooting", subtitle: "Describe steps clearly and confirm understanding", total: 13, emoji: "🛠️", partnerName: "Sam", partnerTitle: "Tech Support" },
    ],
  },

  {
    level: 4,
    scenarios: [
      { id: "l4_second_round_interview", title: "Second-Round Interview", subtitle: "Handle deeper questions and examples", total: 13, emoji: "🧩", partnerName: "Olivia", partnerTitle: "Hiring Manager" },
      { id: "l4_difficult_customer", title: "Angry Customer", subtitle: "De-escalate and set expectations", total: 13, emoji: "🔥", partnerName: "Brian", partnerTitle: "Customer" },
      { id: "l4_public_speaking_intro", title: "Short Presentation", subtitle: "Introduce a topic and handle one question", total: 13, emoji: "🎤", partnerName: "Grace", partnerTitle: "Audience Member" },
      { id: "l4_roommate_conflict", title: "Roommate Conflict", subtitle: "Discuss chores and agree on rules", total: 13, emoji: "🧼", partnerName: "Ethan", partnerTitle: "Roommate" },
      { id: "l4_doctor_followup", title: "Follow-up Appointment", subtitle: "Explain what changed and ask about next steps", total: 13, emoji: "🧾", partnerName: "Dr. Nguyen", partnerTitle: "Doctor" },
      { id: "l4_job_offer_questions", title: "Job Offer Questions", subtitle: "Ask about role scope, growth, and benefits", total: 13, emoji: "📄", partnerName: "Rebecca", partnerTitle: "Recruiter" },
      { id: "l4_client_scope_creep", title: "Scope Creep", subtitle: "Push back and renegotiate scope", total: 13, emoji: "📌", partnerName: "Henry", partnerTitle: "Client" },
      { id: "l4_travel_change_plans", title: "Change Travel Plans", subtitle: "Explain constraints and propose alternatives", total: 13, emoji: "🧳", partnerName: "Rachel", partnerTitle: "your Best Friend" },
      { id: "l4_interview_salary_range", title: "Salary Expectations", subtitle: "Give a range and justify it", total: 13, emoji: "💰", partnerName: "Mark", partnerTitle: "Recruiter" },
      { id: "l4_mediate_argument", title: "Mediate an Argument", subtitle: "Stay neutral and guide toward agreement", total: 13, emoji: "🕊️", partnerName: "Lena", partnerTitle: "Colleague" },
    ],
  },

  {
    level: 5,
    scenarios: [
      { id: "l5_high_stakes_meeting", title: "High-Stakes Meeting", subtitle: "Defend your idea under pressure", total: 13, emoji: "🏛️", partnerName: "Victor", partnerTitle: "Director" },
      { id: "l5_negotiation_vendor", title: "Vendor Negotiation", subtitle: "Negotiate price, terms, and deliverables", total: 13, emoji: "🤝", partnerName: "Alicia", partnerTitle: "Vendor Rep" },
      { id: "l5_interview_case_prompt", title: "Mini Case Prompt", subtitle: "Clarify, structure, and communicate your approach", total: 13, emoji: "🧠", partnerName: "Adrian", partnerTitle: "Interviewer" },
      { id: "l5_difficult_feedback", title: "Give Tough Feedback", subtitle: "Be direct, respectful, and actionable", total: 13, emoji: "🗣️", partnerName: "Sophie", partnerTitle: "Teammate" },
      { id: "l5_customer_retention", title: "Retention Call", subtitle: "Save a customer who wants to cancel", total: 13, emoji: "📉", partnerName: "Nora", partnerTitle: "Customer" },
      { id: "l5_policy_disagreement", title: "Policy Disagreement", subtitle: "Disagree without sounding rude", total: 13, emoji: "⚖️", partnerName: "James", partnerTitle: "Manager" },
      { id: "l5_hiring_screen", title: "Hiring Screen", subtitle: "Explain your experience with strong examples", total: 13, emoji: "👔", partnerName: "Camila", partnerTitle: "Recruiter" },
      { id: "l5_event_hosting", title: "Host an Event", subtitle: "Welcome people and keep energy up", total: 13, emoji: "🎟️", partnerName: "Ella", partnerTitle: "Co-host" },
      { id: "l5_handle_misunderstanding", title: "Clear a Misunderstanding", subtitle: "Repair the situation calmly", total: 13, emoji: "🧩", partnerName: "Mason", partnerTitle: "Friend" },
      { id: "l5_press_interview", title: "Press Interview", subtitle: "Answer concisely and stay on message", total: 13, emoji: "📰", partnerName: "Tara", partnerTitle: "Journalist" },
    ],
  },

  {
    level: 6,
    scenarios: [
      { id: "l6_conflict_manager", title: "Conflict with Manager", subtitle: "Push back respectfully with alternatives", total: 13, emoji: "🧯", partnerName: "Andrew", partnerTitle: "your Manager" },
      { id: "l6_customer_escalation", title: "Escalation Call", subtitle: "Handle escalation, set boundaries, resolve", total: 13, emoji: "📣", partnerName: "Kim", partnerTitle: "Escalations Lead" },
      { id: "l6_complex_interview", title: "Complex Interview", subtitle: "Answer behavioral + technical follow-ups", total: 13, emoji: "🧠", partnerName: "Maya", partnerTitle: "Panel Interviewer" },
      { id: "l6_salary_negotiation", title: "Salary Negotiation", subtitle: "Negotiate comp and handle counteroffers", total: 13, emoji: "💼", partnerName: "David", partnerTitle: "Recruiter" },
      { id: "l6_client_pushback", title: "Client Pushback", subtitle: "Defend a recommendation with logic", total: 13, emoji: "📊", partnerName: "Helena", partnerTitle: "Client" },
      { id: "l6_team_conflict", title: "Team Conflict", subtitle: "Resolve tension and align on next steps", total: 13, emoji: "🧑‍🤝‍🧑", partnerName: "Jon", partnerTitle: "Teammate" },
      { id: "l6_contract_terms", title: "Contract Terms", subtitle: "Clarify legal-ish terms in plain English", total: 13, emoji: "🧾", partnerName: "Irene", partnerTitle: "Legal Counsel" },
      { id: "l6_customer_onboarding", title: "Onboarding a Customer", subtitle: "Explain steps clearly and confirm understanding", total: 13, emoji: "🧭", partnerName: "Peter", partnerTitle: "New Customer" },
      { id: "l6_stakeholder_alignment", title: "Stakeholder Alignment", subtitle: "Align priorities across two stakeholders", total: 13, emoji: "🧷", partnerName: "Asha", partnerTitle: "Product Manager" },
      { id: "l6_sensitive_topic", title: "Sensitive Topic", subtitle: "Discuss a sensitive topic respectfully", total: 13, emoji: "🫶", partnerName: "Clara", partnerTitle: "Friend" },
    ],
  },

  {
    level: 7,
    scenarios: [
      { id: "l7_board_update", title: "Board Update", subtitle: "Give a concise update and answer tough questions", total: 13, emoji: "🏢", partnerName: "Elijah", partnerTitle: "Board Member" },
      { id: "l7_crisis_comms", title: "Crisis Communication", subtitle: "Address a mistake and propose remediation", total: 13, emoji: "🚨", partnerName: "Naomi", partnerTitle: "PR Lead" },
      { id: "l7_strategy_debate", title: "Strategy Debate", subtitle: "Argue for a strategy under disagreement", total: 13, emoji: "♟️", partnerName: "Gabriel", partnerTitle: "Executive" },
      { id: "l7_performance_review", title: "Performance Review", subtitle: "Discuss goals, weaknesses, and growth plan", total: 13, emoji: "📋", partnerName: "Sophia", partnerTitle: "your Manager" },
      { id: "l7_difficult_interview_panel", title: "Panel Interview", subtitle: "Handle rapid follow-ups from multiple people", total: 13, emoji: "👥", partnerName: "Panel", partnerTitle: "Interview Panel" },
      { id: "l7_negotiate_deadline", title: "Negotiate a Deadline", subtitle: "Trade scope for timeline without losing trust", total: 13, emoji: "⏱️", partnerName: "Ravi", partnerTitle: "Project Sponsor" },
      { id: "l7_customer_legal_threat", title: "Legal Threat", subtitle: "De-escalate and respond carefully", total: 13, emoji: "⚠️", partnerName: "Brent", partnerTitle: "Customer" },
      { id: "l7_cross_cultural_meeting", title: "Cross-Cultural Meeting", subtitle: "Be clear, polite, and avoid misunderstandings", total: 13, emoji: "🌍", partnerName: "Yuki", partnerTitle: "Partner" },
      { id: "l7_budget_cut", title: "Budget Cut", subtitle: "Defend priorities and propose tradeoffs", total: 13, emoji: "✂️", partnerName: "Caroline", partnerTitle: "Finance" },
      { id: "l7_pitch_investor", title: "Investor Pitch", subtitle: "Pitch clearly and handle skeptical questions", total: 13, emoji: "💡", partnerName: "Evelyn", partnerTitle: "Investor" },
    ],
  },

  {
    level: 8,
    scenarios: [
      { id: "l8_press_conference", title: "Press Conference", subtitle: "Answer hard questions without rambling", total: 13, emoji: "📺", partnerName: "Reporter", partnerTitle: "Press" },
      { id: "l8_hostile_negotiation", title: "Hostile Negotiation", subtitle: "Stay calm and regain control of the conversation", total: 13, emoji: "🧊", partnerName: "Quinn", partnerTitle: "Counterparty" },
      { id: "l8_technical_incident", title: "Incident Debrief", subtitle: "Explain what happened and next actions", total: 13, emoji: "🧯", partnerName: "Morgan", partnerTitle: "Incident Commander" },
      { id: "l8_manage_underperformer", title: "Manage Underperformance", subtitle: "Set expectations and next steps clearly", total: 13, emoji: "🧑‍💼", partnerName: "Taylor", partnerTitle: "Direct Report" },
      { id: "l8_customer_exec_call", title: "Executive Customer Call", subtitle: "Speak confidently and align on outcomes", total: 13, emoji: "☎️", partnerName: "Sienna", partnerTitle: "Customer VP" },
      { id: "l8_crunch_time", title: "Crunch Time", subtitle: "Motivate the team without sounding pushy", total: 13, emoji: "⚡️", partnerName: "Aiden", partnerTitle: "Teammate" },
      { id: "l8_competing_priorities", title: "Competing Priorities", subtitle: "Choose priorities and justify tradeoffs", total: 13, emoji: "🧭", partnerName: "Ivy", partnerTitle: "Product Owner" },
      { id: "l8_public_disagreement", title: "Public Disagreement", subtitle: "Disagree politely in front of others", total: 13, emoji: "👀", partnerName: "Eli", partnerTitle: "Colleague" },
      { id: "l8_investor_pushback", title: "Investor Pushback", subtitle: "Handle doubts and defend your metrics", total: 13, emoji: "📊", partnerName: "Harper", partnerTitle: "Investor" },
      { id: "l8_high_pressure_interview", title: "High-Pressure Interview", subtitle: "Stay sharp under aggressive questioning", total: 13, emoji: "🧠", partnerName: "Derek", partnerTitle: "Interviewer" },
    ],
  },

  {
    level: 9,
    scenarios: [
      { id: "l9_crisis_leadership", title: "Crisis Leadership", subtitle: "Lead through uncertainty and give direction", total: 13, emoji: "🚒", partnerName: "Zoe", partnerTitle: "Operations Lead" },
      { id: "l9_ceo_one_on_one", title: "CEO One-on-One", subtitle: "Communicate strategically and confidently", total: 13, emoji: "🏛️", partnerName: "Morgan", partnerTitle: "CEO" },
      { id: "l9_deep_case_interview", title: "Deep Case Interview", subtitle: "Structure complex problems and quantify assumptions", total: 13, emoji: "🧮", partnerName: "Case Partner", partnerTitle: "Interviewer" },
      { id: "l9_union_meeting", title: "Union Meeting", subtitle: "Discuss tension and find workable compromise", total: 13, emoji: "🛠️", partnerName: "Rosa", partnerTitle: "Union Rep" },
      { id: "l9_public_apology", title: "Public Apology", subtitle: "Apologize sincerely and commit to action", total: 13, emoji: "🎙️", partnerName: "Ariana", partnerTitle: "Moderator" },
      { id: "l9_multi_party_negotiation", title: "Multi-Party Negotiation", subtitle: "Balance interests across multiple sides", total: 13, emoji: "🧩", partnerName: "Facilitator", partnerTitle: "Mediator" },
      { id: "l9_confidential_topic", title: "Confidential Topic", subtitle: "Speak carefully and ask clarifying questions", total: 13, emoji: "🔒", partnerName: "Nate", partnerTitle: "Legal Advisor" },
      { id: "l9_layoff_conversation", title: "Layoff Conversation", subtitle: "Communicate respectfully and clearly", total: 13, emoji: "🫥", partnerName: "HR", partnerTitle: "HR Partner" },
      { id: "l9_difficult_client_renewal", title: "Renewal Under Threat", subtitle: "Retain a client who is ready to leave", total: 13, emoji: "🧷", partnerName: "Carmen", partnerTitle: "Client" },
      { id: "l9_interview_values_test", title: "Values & Ethics", subtitle: "Handle uncomfortable ethical hypotheticals", total: 13, emoji: "⚖️", partnerName: "Ethan", partnerTitle: "Interviewer" },
    ],
  },

  {
    level: 10,
    scenarios: [
      { id: "l10_global_live_interview", title: "Live Global Interview", subtitle: "Answer perfectly under maximum pressure", total: 13, emoji: "🌐", partnerName: "Sasha", partnerTitle: "Host" },
      { id: "l10_board_crisis_session", title: "Board Crisis Session", subtitle: "Handle crisis questions with calm leadership", total: 13, emoji: "🧨", partnerName: "Board", partnerTitle: "Board Member" },
      { id: "l10_keynote_qna", title: "Keynote Q&A", subtitle: "Answer rapid, tough questions from a crowd", total: 13, emoji: "🎤", partnerName: "Audience", partnerTitle: "Audience" },
      { id: "l10_hostile_press_grill", title: "Hostile Press Grill", subtitle: "Stay on message under aggressive questioning", total: 13, emoji: "📸", partnerName: "Reporter", partnerTitle: "Investigative Journalist" },
      { id: "l10_multi_exec_negotiation", title: "Executive Negotiation", subtitle: "Negotiate with multiple executives at once", total: 13, emoji: "🤝", partnerName: "Elena", partnerTitle: "COO" },
      { id: "l10_rescue_a_failed_deal", title: "Rescue a Failed Deal", subtitle: "Rebuild trust and close the deal", total: 13, emoji: "🧯", partnerName: "Max", partnerTitle: "Partner" },
      { id: "l10_ethics_crisis", title: "Ethics Crisis", subtitle: "Address ethics concerns transparently", total: 13, emoji: "⚠️", partnerName: "Asha", partnerTitle: "Compliance Lead" },
      { id: "l10_lead_massive_change", title: "Lead Massive Change", subtitle: "Align people, address fears, drive action", total: 13, emoji: "🚀", partnerName: "Catherine", partnerTitle: "Change Lead" },
      { id: "l10_final_round_panel", title: "Final Round Panel", subtitle: "Win the room with clarity and confidence", total: 13, emoji: "🏆", partnerName: "Panel", partnerTitle: "Final Interview Panel" },
      { id: "l10_investor_final_close", title: "Final Investor Close", subtitle: "Close the round and handle last objections", total: 13, emoji: "💼", partnerName: "Valerie", partnerTitle: "Lead Investor" },
    ],
  },
];

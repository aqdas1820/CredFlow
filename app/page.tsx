"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { calculateSwipeAmounts } from "../lib/money.mjs";
import {
  LayoutDashboard,
  CreditCard,
  Fuel,
  Plus,
  ArrowUpRight,
  TrendingUp,
  History,
  AlertCircle,
  CheckCircle2,
  X,
  Wallet
} from "lucide-react";

// The public Supabase configuration is optional during local setup and CI builds.
// Avoid throwing during module initialization when the environment is incomplete.
function initializeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return createClient(url, key);
  } catch {
    // Invalid URL or client configuration: render setup guidance instead of crashing.
    return null;
  }
}

const supabase = initializeSupabase();

export default function CredFlowApp() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Data States
  const [personalCards, setPersonalCards] = useState<any[]>([]);
  const [fuelCards, setFuelCards] = useState<any[]>([]);
  const [fuelSwipes, setFuelSwipes] = useState<any[]>([]);

  // Modal States
  const [showAddPersonalModal, setShowAddPersonalModal] = useState(false);
  const [showAddFuelCardModal, setShowAddFuelCardModal] = useState(false);
  const [showSwipeModal, setShowSwipeModal] = useState(false);

  // Form Inputs
  const [pCardName, setPCardName] = useState("");
  const [pLimit, setPLimit] = useState("");
  const [pStatement, setPStatement] = useState("");
  const [pDue, setPDue] = useState("");

  const [fFriendName, setFFriendName] = useState("");
  const [fBank, setFBank] = useState("");
  const [fLimit, setFLimit] = useState("");
  const [fDue, setFDue] = useState("");

  const [selectedFuelCardId, setSelectedFuelCardId] = useState("");
  const [swipeGross, setSwipeGross] = useState("");
  const [swipeFeePercent, setSwipeFeePercent] = useState("1.5");

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: pCards, error: pError } = await supabase.from("personal_cards").select("*");
      const { data: fCards, error: fError } = await supabase.from("fuel_cards").select("*");
      const { data: fSwipes, error: sError } = await supabase.from("fuel_swipes").select("*, fuel_cards(friend_name, card_bank)");

      if (pError || fError || sError) {
        throw new Error("A database query failed");
      }
      setPersonalCards(pCards ?? []);
      setFuelCards(fCards ?? []);
      setFuelSwipes(fSwipes ?? []);
      setFetchError(null);
    } catch {
      setFetchError("Unable to load the latest records. Check your connection and permissions, then try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const swipePreview = calculateSwipeAmounts(Number(swipeGross), Number(swipeFeePercent));

  // Calculations for FuelRotator
  const totalOwedToFriends = fuelSwipes
    .filter(s => s.status === "Pending")
    .reduce((acc, s) => acc + Number(s.gross_amount), 0);

  const totalNetCashInHand = fuelSwipes
    .filter(s => s.status === "Pending")
    .reduce((acc, s) => acc + Number(s.net_amount), 0);

  const totalCommissionPaid = fuelSwipes
    .reduce((acc, s) => acc + (Number(s.gross_amount) - Number(s.net_amount)), 0);

  // A rejected database write must not close the form or erase the user's entries.
  const persistChange = async (
    write: () => Promise<void>,
    onSuccess: () => void,
  ) => {
    if (saving) return;
    setSaving(true);
    setMutationError(null);
    try {
      await write();
      onSuccess();
      await fetchData();
    } catch {
      setMutationError("Changes could not be saved. Please try again; your form entries have been kept.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPersonalCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    await persistChange(
      async () => {
        const { error } = await supabase.from("personal_cards").insert([
          { card_name: pCardName, total_limit: Number(pLimit), statement_date: Number(pStatement), due_date: Number(pDue), utilized_amount: 0 }
        ]);
        if (error) throw error;
      },
      () => {
        setShowAddPersonalModal(false);
        setPCardName(""); setPLimit(""); setPStatement(""); setPDue("");
      },
    );
  };

  const handleAddFuelCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    await persistChange(
      async () => {
        const { error } = await supabase.from("fuel_cards").insert([
          { friend_name: fFriendName, card_bank: fBank, total_limit: Number(fLimit), due_date: Number(fDue) }
        ]);
        if (error) throw error;
      },
      () => {
        setShowAddFuelCardModal(false);
        setFFriendName(""); setFBank(""); setFLimit(""); setFDue("");
      },
    );
  };

  const handleRecordSwipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const amounts = calculateSwipeAmounts(Number(swipeGross), Number(swipeFeePercent));
    if (!amounts) {
      setMutationError("Enter an amount in rupees and paise and a fee between 0% and 100%.");
      return;
    }
    const feePct = Number(swipeFeePercent);
    await persistChange(
      async () => {
        const { error } = await supabase.from("fuel_swipes").insert([
          {
            fuel_card_id: selectedFuelCardId,
            gross_amount: amounts.gross,
            fee_percent: feePct,
            net_amount: amounts.net,
            swipe_date: new Date().toISOString().split("T")[0],
            status: "Pending"
          }
        ]);
        if (error) throw error;
      },
      () => {
        setShowSwipeModal(false);
        setSwipeGross("");
      },
    );
  };

  const markSwipeSettled = async (id: string) => {
    if (!supabase) return;
    await persistChange(
      async () => {
        const { data, error } = await supabase.from("fuel_swipes")
          .update({ status: "Settled" })
          .eq("id", id)
          .select("id");
        if (error || !data?.length) throw new Error("Swipe settlement was not saved");
      },
      () => {},
    );
  };

  if (!supabase) {
    return (
      <main className="min-h-screen bg-[#09090B] text-gray-100 flex items-center justify-center p-6">
        <section role="status" className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-gray-900 p-8 space-y-4">
          <h1 className="text-2xl font-bold text-white">CredFlow setup required</h1>
          <p className="text-gray-300">
            A valid Supabase project URL and public anon key are required to load the dashboard.
            No financial records have been loaded.
          </p>
          <p className="text-gray-300">Set these variables in your local <code>.env.local</code> file or deployment environment:</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-cyan-300">{"NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=..."}</pre>
          <p className="text-sm text-amber-200">
            Only use the public anon key in browser code. Never expose Supabase service-role keys.
            Restart your development server after updating the configuration.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-[#09090B] text-gray-100 font-sans overflow-hidden">

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-[#0F172A]/60 backdrop-blur-xl border-r border-gray-800/60 flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Wallet className="text-white" size={22} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">CredFlow</h1>
              <span className="text-xs text-cyan-400 font-medium">FuelRotator Engine</span>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === "overview" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
                }`}
            >
              <LayoutDashboard size={20} /> Overview
            </button>
            <button
              onClick={() => setActiveTab("personal")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === "personal" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
                }`}
            >
              <CreditCard size={20} /> Personal Cards
            </button>
            <button
              onClick={() => setActiveTab("fuel")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === "fuel" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
                }`}
            >
              <Fuel size={20} /> FuelRotator
            </button>
          </nav>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-xs text-gray-400">
          <p className="font-semibold text-gray-300">Secure Vault</p>
          <p className="mt-1">Cloud database configured; sync not verified</p>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        {fetchError && (
          <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{fetchError}</p>
        )}
        {mutationError && !showAddPersonalModal && !showAddFuelCardModal && !showSwipeModal && (
          <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{mutationError}</p>
        )}
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-cyan-400 font-medium animate-pulse text-lg">Loading CredFlow System...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-8 max-w-6xl mx-auto">
                <header className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Command Center</h2>
                    <p className="text-sm text-gray-400 mt-1">Real-time financial rotation and debt monitoring.</p>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-xl">
                    <p className="text-sm font-medium text-gray-400">Total Liquid Cash (In Hand)</p>
                    <p className="text-3xl font-extrabold text-cyan-400 mt-2">₹{totalNetCashInHand.toLocaleString("en-IN")}</p>
                    <span className="text-xs text-gray-500 mt-1 block">Ready for arbitrage deployment</span>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-xl">
                    <p className="text-sm font-medium text-gray-400">Total Owed to Friends</p>
                    <p className="text-3xl font-extrabold text-red-500 mt-2">₹{totalOwedToFriends.toLocaleString("en-IN")}</p>
                    <span className="text-xs text-gray-500 mt-1 block">Gross pending repayments</span>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-xl">
                    <p className="text-sm font-medium text-gray-400">Total Commission Paid</p>
                    <p className="text-3xl font-extrabold text-orange-400 mt-2">₹{totalCommissionPaid.toLocaleString("en-IN")}</p>
                    <span className="text-xs text-gray-500 mt-1 block">Total cost to fuel agents</span>
                  </div>
                </div>

                <div className="p-8 rounded-2xl bg-gray-900/40 border border-gray-800/80">
                  <h3 className="text-lg font-bold text-white mb-4">Quick Insights</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Your fuel cash rotation is actively operating. Ensure funds are repaid before statement due dates to maintain healthy credit scores for your friends.
                  </p>
                </div>
              </div>
            )}

            {/* PERSONAL CARDS TAB */}
            {activeTab === "personal" && (
              <div className="space-y-8 max-w-6xl mx-auto">
                <header className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Personal Cards</h2>
                    <p className="text-sm text-gray-400 mt-1">Manage your individual credit card limits and bills.</p>
                  </div>
                  <button
                    onClick={() => setShowAddPersonalModal(true)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Plus size={18} /> Add Personal Card
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {personalCards.map((card) => (
                    <div key={card.id} className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg text-white">{card.card_name}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">Limit: ₹{Number(card.total_limit).toLocaleString("en-IN")}</p>
                        </div>
                        <CreditCard className="text-cyan-400" size={24} />
                      </div>
                      <div className="pt-2 border-t border-gray-800 flex justify-between text-xs text-gray-400">
                        <span>Statement: {card.statement_date}th</span>
                        <span>Due: {card.due_date}th</span>
                      </div>
                    </div>
                  ))}
                  {personalCards.length === 0 && (
                    <p className="text-gray-500 italic">No personal cards added yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* FUEL ROTATOR TAB */}
            {activeTab === "fuel" && (
              <div className="space-y-8 max-w-6xl mx-auto">
                <header className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">FuelRotator Module</h2>
                    <p className="text-sm text-gray-400 mt-1">Track friend cards, pump agent commissions, and cash extractions.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddFuelCardModal(true)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 border border-gray-700 transition"
                    >
                      <Plus size={16} /> Add Friend's Card
                    </button>
                    <button
                      onClick={() => setShowSwipeModal(true)}
                      className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-gray-950 font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
                    >
                      <Fuel size={18} /> Record Fuel Swipe
                    </button>
                  </div>
                </header>

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
                    <p className="text-sm font-medium text-gray-400">Total Owed to Friends (Gross)</p>
                    <p className="text-3xl font-extrabold text-red-500 mt-2">₹{totalOwedToFriends.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
                    <p className="text-sm font-medium text-gray-400">Net Cash In Hand</p>
                    <p className="text-3xl font-extrabold text-cyan-400 mt-2">₹{totalNetCashInHand.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {/* Friends Cards Ledger */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Friends Cards Ledger</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {fuelCards.map((fc) => (
                      <div key={fc.id} className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-lg text-white">{fc.friend_name}</h4>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{fc.card_bank}</span>
                        </div>
                        <p className="text-xs text-gray-400">Total Limit: ₹{Number(fc.total_limit).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-gray-400">Due Date: {fc.due_date}th of month</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Swipes Table */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Recent Fuel Swipes</h3>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 bg-gray-950/40">
                          <th className="p-4 font-medium">Friend / Card</th>
                          <th className="p-4 font-medium">Date</th>
                          <th className="p-4 font-medium">Gross Swiped</th>
                          <th className="p-4 font-medium">Agent Fee</th>
                          <th className="p-4 font-medium">Net Cash</th>
                          <th className="p-4 font-medium">Status</th>
                          <th className="p-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {fuelSwipes.map((swipe) => (
                          <tr key={swipe.id} className="hover:bg-gray-800/20 transition">
                            <td className="p-4 font-medium text-white">
                              {swipe.fuel_cards?.friend_name || "Unknown"} <span className="text-xs text-gray-500 block">{swipe.fuel_cards?.card_bank}</span>
                            </td>
                            <td className="p-4 text-gray-400">{swipe.swipe_date}</td>
                            <td className="p-4 text-red-400 font-semibold">₹{Number(swipe.gross_amount).toLocaleString("en-IN")}</td>
                            <td className="p-4 text-orange-400">{swipe.fee_percent}% (-₹{Number(swipe.gross_amount) - Number(swipe.net_amount)})</td>
                            <td className="p-4 text-cyan-400 font-semibold">₹{Number(swipe.net_amount).toLocaleString("en-IN")}</td>
                            <td className="p-4">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${swipe.status === "Pending" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
                                {swipe.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {swipe.status === "Pending" && (
                                <button
                                  onClick={() => markSwipeSettled(swipe.id)}
                                  disabled={saving}
                                  className="text-xs bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-gray-700 px-3 py-1.5 rounded-lg transition"
                                >
                                  Mark Paid
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODALS */}
      {showAddPersonalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add Personal Card</h3>
              <button onClick={() => setShowAddPersonalModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddPersonalCard} className="space-y-4">
              {mutationError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{mutationError}</p>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Card Name / Bank</label>
                <input type="text" required value={pCardName} onChange={(e) => setPCardName(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="e.g. HDFC Regalia" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Total Limit (₹)</label>
                <input type="number" required value={pLimit} onChange={(e) => setPLimit(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="100000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Statement Date (1-31)</label>
                  <input type="number" required min="1" max="31" value={pStatement} onChange={(e) => setPStatement(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="15" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Due Date (1-31)</label>
                  <input type="number" required min="1" max="31" value={pDue} onChange={(e) => setPDue(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="5" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold p-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Card"}</button>
            </form>
          </div>
        </div>
      )}

      {showAddFuelCardModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add Friend's Fuel Card</h3>
              <button onClick={() => setShowAddFuelCardModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddFuelCard} className="space-y-4">
              {mutationError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{mutationError}</p>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Friend's Name</label>
                <input type="text" required value={fFriendName} onChange={(e) => setFFriendName(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="Nadeem" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Card / Bank Name</label>
                <input type="text" required value={fBank} onChange={(e) => setFBank(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="SBI BPCL Octane" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Total Limit (₹)</label>
                <input type="number" required value={fLimit} onChange={(e) => setFLimit(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="100000" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Due Date (1-31)</label>
                <input type="number" required min="1" max="31" value={fDue} onChange={(e) => setFDue(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="10" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold p-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Friend Card"}</button>
            </form>
          </div>
        </div>
      )}

      {showSwipeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Record Fuel Swipe</h3>
              <button onClick={() => setShowSwipeModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordSwipe} className="space-y-4">
              {mutationError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{mutationError}</p>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Friend's Card</label>
                <select required value={selectedFuelCardId} onChange={(e) => setSelectedFuelCardId(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none">
                  <option value="">-- Select Card --</option>
                  {fuelCards.map((fc) => (
                    <option key={fc.id} value={fc.id}>{fc.friend_name} ({fc.card_bank})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Gross Swiped Amount (₹)</label>
                <input type="number" required min="0.01" step="0.01" value={swipeGross} onChange={(e) => setSwipeGross(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="50000" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Agent Fee (%)</label>
                <input type="number" step="0.01" min="0" max="100" required value={swipeFeePercent} onChange={(e) => setSwipeFeePercent(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:border-cyan-500 outline-none" placeholder="1.5" />
              </div>
              {swipePreview && (
                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs space-y-1">
                  <p className="text-gray-400">Net Cash You Get: <span className="text-cyan-400 font-bold">₹{swipePreview.net.toFixed(2)}</span></p>
                  <p className="text-gray-400">Agent Commission Lost: <span className="text-orange-400 font-bold">₹{swipePreview.fee.toFixed(2)}</span></p>
                </div>
              )}
              <button type="submit" disabled={saving} className="w-full bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold p-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Record Swipe"}</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
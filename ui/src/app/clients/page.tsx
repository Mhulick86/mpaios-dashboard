"use client";

import { useState } from "react";
import { Users, Plus, X, Building2 } from "lucide-react";

interface Client {
  id: number;
  name: string;
  industry: string;
  website: string;
  status: "onboarding" | "active" | "paused";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    const newClient: Client = {
      id: Date.now(),
      name: name.trim(),
      industry: industry.trim() || "General",
      website: website.trim(),
      status: "onboarding",
    };
    setClients((prev) => [...prev, newClient]);
    setName("");
    setIndustry("");
    setWebsite("");
    setShowForm(false);
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    onboarding: { bg: "bg-amber-50", text: "text-amber-700" },
    active: { bg: "bg-brand-green/10", text: "text-brand-green" },
    paused: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-semibold">Clients</h1>
          <p className="text-[14px] text-text-secondary mt-1">
            Client management and campaign oversight
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-blue text-white text-[13px] font-medium rounded-lg hover:bg-brand-blue-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Client
        </button>
      </div>

      {/* Add Client Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-border shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-[16px] font-semibold">Add New Client</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Healthcare"
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Industry
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Healthcare, SaaS, E-commerce"
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Website
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. https://acme.com"
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                className="px-4 py-2 bg-brand-blue text-white text-[13px] font-medium rounded-lg hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client List or Empty State */}
      {clients.length === 0 ? (
        <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-brand-blue" />
          </div>
          <h2 className="text-[16px] font-semibold mb-2">No clients yet</h2>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto leading-relaxed">
            Add your first client to begin onboarding. Each client gets a
            dedicated workspace with assigned agents, active campaigns, and
            performance tracking.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 px-5 py-2.5 bg-brand-blue text-white text-[13px] font-medium rounded-lg hover:bg-brand-blue-dark transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const colors = statusColors[client.status];
            return (
              <div
                key={client.id}
                className="bg-surface-raised rounded-xl border border-border p-5 hover:border-gray-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold">{client.name}</h3>
                      <p className="text-[11px] text-text-muted">{client.industry}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${colors.bg} ${colors.text}`}
                  >
                    {client.status}
                  </span>
                </div>
                {client.website && (
                  <p className="text-[12px] text-text-secondary truncate">
                    {client.website}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      setClients((prev) =>
                        prev.map((c) =>
                          c.id === client.id
                            ? { ...c, status: c.status === "active" ? "paused" : "active" }
                            : c
                        )
                      )
                    }
                    className="text-[11px] font-medium text-brand-blue hover:text-brand-blue-dark transition-colors"
                  >
                    {client.status === "active" ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() =>
                      setClients((prev) => prev.filter((c) => c.id !== client.id))
                    }
                    className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setShowForm(true)}
            className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all min-h-[140px]"
          >
            <Plus className="w-5 h-5 text-text-muted" />
            <span className="text-[12px] font-medium text-text-muted">Add Client</span>
          </button>
        </div>
      )}
    </div>
  );
}

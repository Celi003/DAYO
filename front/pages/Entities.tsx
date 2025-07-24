import React, { useState, useEffect } from "react";
import {
  getBrokers,
  getCompanies,
  createBroker,
  updateBroker,
  deleteBroker,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../services/api";
import { useNotification } from "../components/NotificationContext";
import { useApi } from "../services/api";
import ConfirmModal from "../components/Modal";

const Entities: React.FC = () => {
  const [tab, setTab] = useState<"brokers" | "companies">("brokers");
  const [brokers, setBrokers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    onConfirm: () => void;
    message: string;
  }>({ open: false, onConfirm: () => {}, message: "" });
  const { notify } = useNotification();
  const { call } = useApi();

  // Brokers
  useEffect(() => {
    if (tab === "brokers") fetchBrokers();
  }, [tab]);
  const fetchBrokers = async () => {
    setLoading(true);
    const data = await call(() => getBrokers());
    if (data) setBrokers(data);
    setLoading(false);
  };
  const handleAddBroker = async (data: any) => {
    await call(() => createBroker(data), "Courtier ajouté");
    fetchBrokers();
  };
  const handleUpdateBroker = async (id: string, data: any) => {
    await call(() => updateBroker(id, data), "Courtier modifié");
    fetchBrokers();
  };
  const handleDeleteBroker = (id: string) => {
    setConfirm({
      open: true,
      onConfirm: async () => {
        await call(() => deleteBroker(id), "Courtier supprimé");
        fetchBrokers();
        setConfirm({ ...confirm, open: false });
      },
      message: "Confirmer la suppression de ce courtier ?",
    });
  };

  // Companies
  useEffect(() => {
    if (tab === "companies") fetchCompanies();
  }, [tab]);
  const fetchCompanies = async () => {
    setLoading(true);
    const data = await call(() => getCompanies());
    if (data) setCompanies(data);
    setLoading(false);
  };
  const handleAddCompany = async (data: any) => {
    await call(() => createCompany(data), "Compagnie ajoutée");
    fetchCompanies();
  };
  const handleUpdateCompany = async (id: string, data: any) => {
    await call(() => updateCompany(id, data), "Compagnie modifiée");
    fetchCompanies();
  };
  const handleDeleteCompany = (id: string) => {
    setConfirm({
      open: true,
      onConfirm: async () => {
        await call(() => deleteCompany(id), "Compagnie supprimée");
        fetchCompanies();
        setConfirm({ open: false, onConfirm: () => {}, message: "" });
      },
      message: "Confirmer la suppression de cette compagnie ?",
    });
  };

  return (
    <div className="p-8">
      <ConfirmModal
        title="Confirmation"
        isOpen={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
      >
        <div>
          <p className="mb-4">{confirm.message}</p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setConfirm({ ...confirm, open: false })}
              className="px-4 py-2 bg-slate-200 rounded"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                confirm.onConfirm();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Confirmer
            </button>
          </div>
        </div>
      </ConfirmModal>
      <h1 className="text-3xl font-bold mb-6">Gestion des entités</h1>
      <div className="flex border-b">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            tab === "brokers"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("brokers")}
        >
          Courtiers
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            tab === "companies"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("companies")}
        >
          Compagnies
        </button>
      </div>
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-slate-500"></div>
        </div>
      )}
      {!loading && tab === "brokers" && (
        <EntityTable
          data={brokers}
          onAdd={handleAddBroker}
          onUpdate={handleUpdateBroker}
          onDelete={handleDeleteBroker}
          type="Courtier"
        />
      )}
      {!loading && tab === "companies" && (
        <EntityTable
          data={companies}
          brokers={brokers}
          onAdd={handleAddCompany}
          onUpdate={handleUpdateCompany}
          onDelete={handleDeleteCompany}
          type="Compagnie"
        />
      )}
    </div>
  );
};

const EntityTable: React.FC<{
  data: any[];
  brokers?: any[];
  onAdd: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  type: string;
}> = ({ data, brokers, onAdd, onUpdate, onDelete, type }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ col: string; asc: boolean }>({
    col: "",
    asc: true,
  });
  const pageSize = 10;
  const { notify } = useNotification();

  const getFields = () => {
    switch (type) {
      case "Courtier":
        return { name: "text" };
      case "Compagnie":
        return {
          name: "text",
          contact_email: "email",
          broker: "select_broker",
        };
      default:
        return {};
    }
  };
  const fields = getFields();
  const fieldNames = Object.keys(fields);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const k of fieldNames) {
      if (!form[k] || form[k].toString().trim() === "") {
        errs[k] = "Ce champ est requis";
      }
      if (
        k.toLowerCase().includes("email") &&
        form[k] &&
        !/^\S+@\S+\.\S+$/.test(form[k])
      ) {
        errs[k] = "Format email invalide";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    let dataToSend = { ...form };
    if (type === "Compagnie") {
      dataToSend = { ...form, broker_id: form.broker };
      delete dataToSend.broker;
    }
    if (editId) onUpdate(editId, dataToSend);
    else onAdd(dataToSend);
    setEditId(null);
    setForm({});
    setErrors({});
  };

  // Recherche
  const filtered = data.filter((item) =>
    Object.values(item).some(
      (v) => v && v.toString().toLowerCase().includes(search.toLowerCase())
    )
  );
  // Tri
  const sorted = sort.col
    ? [...filtered].sort((a, b) => {
        if (a[sort.col] === b[sort.col]) return 0;
        if (a[sort.col] == null) return 1;
        if (b[sort.col] == null) return -1;
        return (
          a[sort.col]
            .toString()
            .localeCompare(b[sort.col].toString(), undefined, {
              numeric: true,
            }) * (sort.asc ? 1 : -1)
        );
      })
    : filtered;
  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleStartEdit = (item: any) => {
    setEditId(item.id);
    const formData: any = {};
    // For company, broker is an object in data, but form needs broker id
    if (
      type === "Compagnie" &&
      item.broker &&
      typeof item.broker === "object"
    ) {
      formData.broker = item.broker.id;
    }
    setForm({ ...item, ...formData });
  };

  return (
    <div>
      <h3 className="text-xl font-bold mt-4 mb-2">
        Ajouter/Modifier un(e) {type}
      </h3>
      <form
        onSubmit={handleSubmit}
        className="flex gap-4 mb-4 flex-wrap items-end p-4 bg-slate-50 rounded-md"
      >
        {fieldNames.map((k) => (
          <div key={k} className="flex flex-col">
            <label className="text-sm font-medium text-slate-600 mb-1 capitalize">
              {k.replace("_", " ")}
            </label>
            {(fields as any)[k] === "select_broker" ? (
              <select
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className={`p-2 border rounded-md ${
                  errors[k] ? "border-red-500" : "border-slate-300"
                }`}
              >
                <option value="">Choisir...</option>
                {brokers?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder={k.replace("_", " ")}
                value={form[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className={`p-2 border rounded-md ${
                  errors[k] ? "border-red-500" : "border-slate-300"
                }`}
                type={(fields as any)[k]}
              />
            )}
            {errors[k] && (
              <span className="text-red-600 text-xs mt-1">{errors[k]}</span>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700"
          >
            {editId ? "Enregistrer" : "Ajouter"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm({});
                setErrors({});
              }}
              className="bg-slate-200 py-2 px-4 rounded-md hover:bg-slate-300"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <h3 className="text-xl font-bold mt-8 mb-2">Liste des {type}s</h3>
      <div className="flex flex-wrap gap-2 mb-2 items-center bg-slate-50 p-2 rounded">
        <input
          placeholder="Recherche..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border p-1"
        />
        <span className="text-sm text-slate-500">
          {sorted.length} résultat(s)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow-sm">
          <thead className="bg-slate-100">
            <tr>
              {Object.keys(data[0] || {})
                .filter(
                  (k) => k !== "id" && typeof (data[0] || {})[k] !== "object"
                )
                .map((k) => (
                  <th
                    key={k}
                    className="p-3 text-left text-sm font-semibold text-slate-600"
                  >
                    {k} {sort.col === k ? (sort.asc ? "▲" : "▼") : ""}
                  </th>
                ))}
              {type === "Compagnie" && (
                <th className="p-3 text-left text-sm font-semibold text-slate-600">
                  Courtier
                </th>
              )}
              <th className="p-3 text-left text-sm font-semibold text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((item) => (
              <tr key={item.id} className="border-b hover:bg-slate-50">
                {Object.keys(item)
                  .filter((k) => k !== "id" && typeof item[k] !== "object")
                  .map((k) => (
                    <td key={k} className="p-3">
                      {item[k]}
                    </td>
                  ))}
                {type === "Compagnie" && (
                  <td className="p-3">{item.broker?.name || "-"}</td>
                )}
                <td className="p-3 flex gap-2 justify-center">
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="text-xs bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-full hover:bg-blue-200"
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-xs bg-red-100 text-red-800 font-semibold py-1 px-3 rounded-full hover:bg-red-200"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-2 items-center my-4">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-100"
        >
          Préc.
        </button>
        <span>
          Page {page} sur {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-100"
        >
          Suiv.
        </button>
      </div>
    </div>
  );
};

export default Entities;

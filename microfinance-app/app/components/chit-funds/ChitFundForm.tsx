import { useEffect, useState } from "react";
import { FixedAmountTemplateWithRows } from "@/app/lib/templateService";
import { TemplateSelection } from "@/app/components/templates/TemplateSelection";

interface ChitFundFormProps {
  onSubmit: (data: {
    name: string;
    totalAmount: number;
    monthlyContribution: number;
    firstMonthContribution?: number;
    duration: Int;
    membersCount: number;
    startDate: Date;
    description?: string;
    chitFundType: "Auction" | "Fixed";
    templateId?: number;
  }) => void;
}

export function ChitFundForm({ onSubmit }: ChitFundFormProps) {
  const [templates, setTemplates] = useState<FixedAmountTemplateWithRows[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    totalAmount: 0,
    monthlyContribution: 0,
    firstMonthContribution: 0,
    duration: 20,
    membersCount: 20,
    startDate: new Date().toISOString().split("T")[0],
    description: "",
    chitFundType: "Auction" as "Auction" | "Fixed",
    templateId: null as number | null,
  });

  useEffect(() => {
    if (formData.chitFundType === "Fixed") {
      fetchTemplates();
    }
  }, [formData.chitFundType]);

  async function fetchTemplates() {
    const response = await fetch("/api/templates");
    if (response.ok) {
      const data = await response.json();
      setTemplates(data);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      templateId: formData.chitFundType === "Fixed" ? formData.templateId : undefined,
    });
  };

  const handleTemplateSelect = (templateId: number | null) => {
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setFormData((prev) => ({
          ...prev,
          templateId,
          totalAmount: template.totalAmount,
          duration: template.duration,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        templateId: null,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Chit Fund Type
        </label>
        <select
          value={formData.chitFundType}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              chitFundType: e.target.value as "Auction" | "Fixed",
              templateId: null,
            }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="Auction">Auction</option>
          <option value="Fixed">Fixed</option>
        </select>
      </div>

      {formData.chitFundType === "Fixed" ? (
        <TemplateSelection
          templates={templates}
          onSelect={handleTemplateSelect}
          selectedTemplateId={formData.templateId}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total Amount
              </label>
              <input
                type="number"
                value={formData.totalAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    totalAmount: Number(e.target.value),
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Monthly Contribution
              </label>
              <input
                type="number"
                value={formData.monthlyContribution}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    monthlyContribution: Number(e.target.value),
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Month Contribution
              </label>
              <input
                type="number"
                value={formData.firstMonthContribution}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    firstMonthContribution: Number(e.target.value),
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duration (months)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    duration: Number(e.target.value),
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="1"
                max="60"
              />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Members Count
          </label>
          <input
            type="number"
            value={formData.membersCount}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                membersCount: Number(e.target.value),
              }))
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, startDate: e.target.value }))
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          Create Chit Fund
        </button>
      </div>
    </form>
  );
}

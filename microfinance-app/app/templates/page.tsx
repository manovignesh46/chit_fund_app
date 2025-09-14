'use client';

import { useEffect, useState } from "react";
import { TemplateList } from "@/app/components/templates/TemplateList";
import { TemplateForm } from "@/app/components/templates/TemplateForm";
import { Button } from "@/app/components/common/Button";
import { FixedAmountTemplateWithRows } from "@/app/lib/templateService";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<FixedAmountTemplateWithRows[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<
    FixedAmountTemplateWithRows | undefined
  >();
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    const response = await fetch("/api/templates");
    if (response.ok) {
      const data = await response.json();
      setTemplates(data);
    }
  }

  async function handleSubmit(data: {
    name: string;
    description?: string;
    totalAmount: number;
    duration: number;
    amounts: { month: number; amount: number }[];
  }) {
    const url = editingTemplate
      ? `/api/templates/${editingTemplate.id}`
      : "/api/templates";
    const method = editingTemplate ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      await fetchTemplates();
      setIsFormOpen(false);
      setEditingTemplate(undefined);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    const response = await fetch(`/api/templates/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchTemplates();
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fixed Amount Templates</h1>
        <Button
          onClick={() => {
            setEditingTemplate(undefined);
            setIsFormOpen(true);
          }}
          className="bg-green-500 hover:bg-green-600"
        >
          Create New Template
        </Button>
      </div>

      {isFormOpen ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingTemplate ? "Edit" : "Create"} Template
          </h2>
          <TemplateForm
            template={editingTemplate}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingTemplate(undefined);
            }}
          />
        </div>
      ) : (
        <TemplateList
          templates={templates}
          onEdit={(template) => {
            setEditingTemplate(template);
            setIsFormOpen(true);
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

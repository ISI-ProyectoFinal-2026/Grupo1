import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { create } from "@/api/reports.api";

export function useCreateReport() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: create,
    onSuccess: (report) => {
      navigate(`/reports/${report.id}`);
    },
  });
}

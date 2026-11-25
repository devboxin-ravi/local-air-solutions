/**
 * Create / edit a service: details, photo, pricing & GST, skills, branches, visibility and reminders,
 * in a single full-width form.
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Wand2 } from "lucide-react";
import { useService, useServiceActions } from "@/hooks/useCatalog";
import {
  fieldErrors,
  useBranches,
  useCategories,
  useSkills,
  errorMessage,
} from "@/hooks/useApi";
import { ROUTES } from "@/constants/routes";
import { LIMITS, PRICING_TYPES, SERVICE_CODE_MAX } from "@/constants/ui";
import { emptyToNull, serviceSchema, type ServiceForm } from "@/lib/validation";
import { assetUrl, cn, codeFromName } from "@/lib/utils";
import {
  ErrorState,
  Field,
  FormCard,
  FormSection,
  LoadingBlock,
  PageHeader,
} from "@/components/common";
import { ChipMultiSelect } from "@/components/Pickers";
import { ImageUpload } from "@/components/ImageUpload";
import {
  DurationPicker,
  PrefixInput,
  PricingTypeCards,
} from "@/components/ServiceFormParts";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { toast } from "sonner";

const GST_RATES = [0, 5, 12, 18, 28];

const DEFAULTS: ServiceForm = {
  categoryId: 0,
  code: "",
  name: "",
  description: "",
  imageUrl: "",
  durationMinutes: 60,
  pricingType: "FIXED",
  basePrice: 0,
  gstApplicable: true,
  gstRate: 18,
  reminderEligible: false,
  reminderIntervalMonths: "",
  isPopular: false,
  isActive: true,
  skillIds: [],
  branchIds: [],
};

export default function ServiceFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const existing = useService(id);
  const { data: categories } = useCategories();
  const { data: skills } = useSkills();
  const { data: branches } = useBranches();
  const actions = useServiceActions();
  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: DEFAULTS,
  });
  const e = form.formState.errors;
  const v = form.watch();
  const priceDisabled =
    v.pricingType === "FREE" || v.pricingType === "QUOTATION";

  useEffect(() => {
    const s = existing.data;
    if (s)
      form.reset({
        categoryId: s.categoryId,
        code: s.code,
        name: s.name,
        description: s.description ?? "",
        imageUrl: s.imageUrl ?? "",
        durationMinutes: s.durationMinutes,
        pricingType: s.pricingType,
        basePrice: s.basePrice,
        gstApplicable: s.gstApplicable,
        gstRate: s.gstRate,
        reminderEligible: s.reminderEligible,
        reminderIntervalMonths: s.reminderIntervalMonths ?? "",
        isPopular: s.isPopular,
        isActive: s.isActive,
        skillIds: s.skills.map((k) => k.id),
        branchIds: s.branches.map((b) => b.id),
      });
  }, [existing.data, form]);

  const onSubmit = form.handleSubmit(async (val) => {
    const body = emptyToNull({
      ...val,
      basePrice:
        val.pricingType === "FREE" || val.pricingType === "QUOTATION"
          ? 0
          : val.basePrice,
    });
    try {
      if (id) await actions.update.mutateAsync({ id, body });
      else await actions.create.mutateAsync(body);
      navigate(ROUTES.SERVICES);
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) =>
        form.setError(k as keyof ServiceForm, { message: m }),
      );
      toast.error(errorMessage(err));
    }
  });

  if (id && existing.isLoading) return <LoadingBlock rows={8} />;
  if (id && existing.error)
    return (
      <ErrorState
        message={(existing.error as Error).message}
        onRetry={() => existing.refetch()}
      />
    );

  const saveButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => navigate(ROUTES.SERVICES)}
      >
        Cancel
      </Button>
      <Button type="submit" loading={form.formState.isSubmitting}>
        <Save /> {id ? "Save changes" : "Create service"}
      </Button>
    </>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={id ? `Edit ${existing.data?.name ?? "service"}` : "Add Service"}
        description="Services are fetched by the apps from here — no code changes needed."
        breadcrumbs={[
          { label: "Services", to: ROUTES.SERVICES },
          { label: id ? "Edit" : "Add Service" },
        ]}
        actions={saveButtons}
      />

      <FormCard footer={saveButtons}>
        <FormSection
          step={1}
          title="Details"
          description="What customers see first: name, category and how long the job takes."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Service name"
              required
              error={e.name?.message}
              className="sm:col-span-2"
            >
              <Input
                {...form.register("name")}
                maxLength={LIMITS.NAME_MAX}
                placeholder="e.g. AC General Servicing"
                aria-invalid={!!e.name}
              />
            </Field>
            <Field
              label="Service code"
              required
              error={e.code?.message}
              hint="Unique internal code, e.g. AC-GEN-SVC"
            >
              <div className="relative">
                <Input
                  {...form.register("code")}
                  className="pr-28 uppercase"
                  maxLength={SERVICE_CODE_MAX}
                  placeholder="AC-GEN-SVC"
                  aria-invalid={!!e.code}
                />
                <button
                  type="button"
                  disabled={!(v.name ?? "").trim()}
                  onClick={() =>
                    form.setValue(
                      "code",
                      codeFromName(v.name ?? "", SERVICE_CODE_MAX),
                      { shouldValidate: true, shouldDirty: true },
                    )
                  }
                  className="absolute inset-y-1 right-1 inline-flex items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-brand-blue hover:bg-brand-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Generate
                </button>
              </div>
            </Field>
            <Field label="Category" required error={e.categoryId?.message}>
              <NativeSelect
                {...form.register("categoryId")}
                aria-invalid={!!e.categoryId}
              >
                <option value={0}>Select category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Estimated duration"
              required
              error={e.durationMinutes?.message}
              className="sm:col-span-2"
            >
              <DurationPicker
                value={Number(v.durationMinutes)}
                invalid={!!e.durationMinutes}
                inputProps={form.register("durationMinutes")}
                onChange={(m) =>
                  form.setValue("durationMinutes", m, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </Field>
            <Field
              label="Description"
              className="sm:col-span-2"
              error={e.description?.message}
              hint="One or two lines on what is included — shown on the service card."
              counter={{
                value: (v.description ?? "").length,
                max: LIMITS.DESCRIPTION_MAX,
              }}
            >
              <Textarea
                {...form.register("description")}
                maxLength={LIMITS.DESCRIPTION_MAX}
                placeholder="e.g. Filter & coil cleaning, gas pressure check and cooling test."
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          step={2}
          title="Photo"
          description="Shown on the service card in the customer app."
        >
          <Field error={e.imageUrl?.message}>
            <Controller
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUpload
                  previewUrl={assetUrl(field.value)}
                  uploading={actions.uploadImage.isPending}
                  invalid={!!e.imageUrl}
                  onReject={(m) => toast.error(m)}
                  onSelect={(file) =>
                    actions.uploadImage.mutate(file, {
                      onSuccess: (r) => field.onChange(r.path),
                    })
                  }
                  onClear={() => field.onChange("")}
                />
              )}
            />
          </Field>
        </FormSection>

        <FormSection
          step={3}
          title="Pricing & tax"
          description="Changing the price never alters existing bookings or invoices."
        >
          <div className="space-y-5">
            <Controller
              control={form.control}
              name="pricingType"
              render={({ field }) => (
                <PricingTypeCards
                  options={PRICING_TYPES}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Base price"
                required={!priceDisabled}
                error={e.basePrice?.message}
                hint={
                  priceDisabled ? "Not needed for this pricing type" : undefined
                }
              >
                <PrefixInput
                  prefix="₹"
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={priceDisabled}
                  {...form.register("basePrice")}
                  aria-invalid={!!e.basePrice}
                />
              </Field>
              <Field label="GST" error={e.gstRate?.message}>
                <div className="flex h-control items-center gap-3">
                  <Controller
                    control={form.control}
                    name="gstApplicable"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="GST applicable"
                      />
                    )}
                  />
                  <div className="flex flex-wrap gap-1">
                    {GST_RATES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={!v.gstApplicable}
                        onClick={() =>
                          form.setValue("gstRate", r, { shouldDirty: true })
                        }
                        className={cn(
                          "h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40",
                          Number(v.gstRate) === r && v.gstApplicable
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "bg-white text-slate-600 hover:border-brand-blue-200",
                        )}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection
          step={4}
          title="Technician skills"
          description="Used to suggest the right technician."
        >
          <Controller
            control={form.control}
            name="skillIds"
            render={({ field }) => (
              <ChipMultiSelect
                options={skills ?? []}
                value={field.value}
                onChange={field.onChange}
                emptyText="Add skills in Master Data first."
              />
            )}
          />
        </FormSection>

        <FormSection
          step={5}
          title="Branch availability"
          description="Leave empty to offer this service in every branch."
        >
          <Controller
            control={form.control}
            name="branchIds"
            render={({ field }) => (
              <ChipMultiSelect
                options={branches ?? []}
                value={field.value}
                onChange={field.onChange}
                emptyText="No branches yet."
              />
            )}
          />
        </FormSection>

        <FormSection
          step={6}
          title="Visibility"
          description="Whether customers can book it and if it is featured."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow
              control={form.control}
              name="isActive"
              label="Active"
              hint="Inactive services are hidden from booking"
            />
            <ToggleRow
              control={form.control}
              name="isPopular"
              label="Popular service"
              hint="Highlighted on the customer home screen"
            />
          </div>
        </FormSection>

        <FormSection
          step={7}
          title="Service reminders"
          description="Follow-up reminder to the customer after the job."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow
              control={form.control}
              name="reminderEligible"
              label="Remind after completion"
              hint="Sends a service-due reminder later"
            />
            <Field
              label="Interval (months)"
              hint="Empty = company default (6 months)"
              error={e.reminderIntervalMonths?.message}
            >
              <Input
                type="number"
                min={1}
                max={36}
                disabled={!v.reminderEligible}
                placeholder="6"
                {...form.register("reminderIntervalMonths")}
              />
            </Field>
          </div>
        </FormSection>
      </FormCard>
    </form>
  );
}

const ToggleRow = ({
  control,
  name,
  label,
  hint,
}: {
  control: ReturnType<typeof useForm<ServiceForm>>["control"];
  name: "gstApplicable" | "isActive" | "isPopular" | "reminderEligible";
  label: string;
  hint?: string;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors",
          field.value
            ? "border-brand-blue-100 bg-brand-blue-50/40"
            : "bg-white",
        )}
      >
        <div>
          <Label>{label}</Label>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
          aria-label={label}
        />
      </div>
    )}
  />
);

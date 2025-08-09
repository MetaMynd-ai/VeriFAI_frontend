import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog'; // Required for MatDialogContent, MatDialogActions etc.
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-success-dialog',
  template: `
    <h1 mat-dialog-title class="flex items-center">
      <mat-icon color="primary" class="mr-2">check_circle</mat-icon>
      <span>{{ data.title }}</span>
    </h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="onOkClick()">OK</button>
    </div>
  `,
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
})
export class SuccessDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SuccessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; message: string }
  ) {}

  onOkClick(): void {
    this.dialogRef.close(true);
  }
}
